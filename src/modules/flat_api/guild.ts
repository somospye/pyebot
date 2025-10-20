import { eq } from "drizzle-orm";

import { guilds } from "@/schemas/guild";

import {
  buildGuildInsert,
  createDefaultChannelsRecord,
  createEmptyRoleRecord,
  deepClone,
  generateManagedChannelId,
  normaliseActionName,
  normaliseGuildRow,
  runWithError,
  resolveManagedKey,
  sanitiseUpdate,
  toManagedRoleSnapshot,
  toManagedRoleSnapshots,
  withChannelDefaults,
} from "./helpers";
import type {
  ActionName,
  ChannelId,
  CoreChannelName,
  CoreChannelRecord,
  DatabaseClient,
  GuildChannelsRecord,
  GuildId,
  GuildInit,
  GuildRow,
  GuildRolesRecord,
  GuildUpdate,
  LimitDef,
  ManagedChannelInput,
  ManagedChannelRecord,
  ManagedChannelUpdate,
  ManagedRoleSnapshot,
  OverrideValue,
  RoleKey,
  RoleLimitMap,
} from "./types";

type ChannelsMutator = (current: GuildChannelsRecord) => GuildChannelsRecord;
type RolesMutator = (current: GuildRolesRecord) => GuildRolesRecord;

export function createGuildApi(db: DatabaseClient) {
  const getGuild = async (guildId: GuildId): Promise<GuildRow | null> => {
    const row = await runWithError(
      async () => {
        const [record] = await db
          .select()
          .from(guilds)
          .where(eq(guilds.id, guildId))
          .limit(1);
        return record ?? null;
      },
      `Failed to load guild (id=${guildId})`,
    );
    return row ? normaliseGuildRow(row) : null;
  };

  const guildExists = async (guildId: GuildId): Promise<boolean> =>
    runWithError(
      async () => {
        const [record] = await db
          .select({ id: guilds.id })
          .from(guilds)
          .where(eq(guilds.id, guildId))
          .limit(1);
        return !!record;
      },
      `Failed to check guild existence (id=${guildId})`,
    );

  const createGuild = async (
    guildId: GuildId,
    init: GuildInit = {},
    overwrite = false,
  ): Promise<GuildRow> => {
    const insertValues = buildGuildInsert(guildId, init);

    if (overwrite) {
      const upserted = await runWithError(
        async () => {
          const [record] = await db
            .insert(guilds)
            .values(insertValues)
            .onConflictDoUpdate({
              target: guilds.id,
              set: {
                channels:
                  insertValues.channels ?? createDefaultChannelsRecord(),
                roles: insertValues.roles ?? {},
                updatedAt: insertValues.updatedAt ?? new Date(),
              },
            })
            .returning();
          return record ?? null;
        },
        `Failed to upsert guild (id=${guildId})`,
      );
      if (!upserted) {
        throw new Error(`Failed to upsert guild (id=${guildId})`);
      }
      return normaliseGuildRow(upserted);
    }

    const inserted = await runWithError(
      async () => {
        const [record] = await db
          .insert(guilds)
          .values(insertValues)
          .onConflictDoNothing()
          .returning();
        return record ?? null;
      },
      `Failed to create guild (id=${guildId})`,
    );
    if (inserted) {
      return normaliseGuildRow(inserted);
    }

    const fallback = await getGuild(guildId);
    if (!fallback) {
      throw new Error(`Failed to create guild (id=${guildId})`);
    }
    return fallback;
  };

  const ensureGuild = async (
    guildId: GuildId,
    init: GuildInit = {},
  ): Promise<GuildRow> => {
    const existing = await getGuild(guildId);
    if (existing) {
      return existing;
    }
    return await createGuild(guildId, init, false);
  };

  const updateGuild = async (
    guildId: GuildId,
    changes: GuildUpdate,
  ): Promise<GuildRow> => {
    const payload = sanitiseUpdate(changes);
    if (Object.keys(payload).length === 0) {
      const existing = await getGuild(guildId);
      if (!existing) {
        throw new Error(`Guild not found (id=${guildId})`);
      }
      return existing;
    }

    if (payload.channels) {
      payload.channels = deepClone(withChannelDefaults(payload.channels));
    }
    if (payload.roles) {
      payload.roles = deepClone(payload.roles);
    }
    if (!payload.updatedAt) {
      payload.updatedAt = new Date();
    }

    const updated = await runWithError(
      async () => {
        const [record] = await db
          .update(guilds)
          .set(payload)
          .where(eq(guilds.id, guildId))
          .returning();
        return record ?? null;
      },
      `Failed to update guild (id=${guildId})`,
    );
    if (!updated) {
      throw new Error(`Guild not found when updating guild (id=${guildId})`);
    }
    return normaliseGuildRow(updated);
  };

  const removeGuild = async (guildId: GuildId): Promise<boolean> =>
    runWithError(
      async () => {
        const result = await db.delete(guilds).where(eq(guilds.id, guildId));
        return (result.rowCount ?? 0) > 0;
      },
      `Failed to remove guild (id=${guildId})`,
    );

  const getGuildChannels = async (
    guildId: GuildId,
  ): Promise<GuildChannelsRecord> => {
    const ensured = await ensureGuild(guildId);
    return deepClone(withChannelDefaults(ensured.channels));
  };

  const getGuildCoreChannel = async (
    guildId: GuildId,
    name: CoreChannelName,
  ): Promise<CoreChannelRecord | null> => {
    const snapshot = await getGuildChannels(guildId);
    return snapshot.core[name] ?? null;
  };

  const writeChannels = async (
    guildId: GuildId,
    mutate: ChannelsMutator,
  ): Promise<GuildChannelsRecord> => {
    const ensured = await ensureGuild(guildId);
    const current = withChannelDefaults(ensured.channels);
    const draft = deepClone(current);
    const mutated = mutate(draft);
    const next = deepClone(withChannelDefaults(mutated));

    const updated = await runWithError(
      async () => {
        const [record] = await db
          .update(guilds)
          .set({
            channels: next,
            updatedAt: new Date(),
          })
          .where(eq(guilds.id, guildId))
          .returning();
        return record ?? null;
      },
      `Failed to update guild channels (id=${guildId})`,
    );
    if (!updated) {
      throw new Error(
        `Guild not found when updating channels (id=${guildId})`,
      );
    }

    return deepClone(withChannelDefaults(updated.channels));
  };

  const setGuildCoreChannel = async (
    guildId: GuildId,
    name: CoreChannelName,
    channelId: ChannelId,
  ): Promise<CoreChannelRecord> => {
    const snapshot = await writeChannels(guildId, (current) => ({
      ...current,
      core: {
        ...current.core,
        [name]: {
          ...(current.core[name] ?? {
            name,
            label: createDefaultChannelsRecord().core[name]?.label ?? name,
            channelId: "",
          }),
          channelId,
        },
      },
    }));
    return snapshot.core[name];
  };

  const setGuildTicketCategory = async (
    guildId: GuildId,
    categoryId: ChannelId | null,
  ): Promise<ChannelId | null> => {
    const snapshot = await writeChannels(guildId, (current) => ({
      ...current,
      ticketCategoryId: categoryId ?? null,
      ticketCategory: categoryId ?? null,
    }));
    const value = snapshot.core.ticketCategory?.channelId;
    return value ? (value as ChannelId) : null;
  };

  const setGuildTicketMessage = async (
    guildId: GuildId,
    messageId: string | null,
  ): Promise<void> => {
    await writeChannels(guildId, (current) => ({
      ...current,
      ticketMessageId: messageId,
    }));
  };

  const listGuildManagedChannels = async (
    guildId: GuildId,
  ): Promise<ManagedChannelRecord[]> => {
    const snapshot = await getGuildChannels(guildId);
    return Object.values(snapshot.managed);
  };

  const findGuildManagedChannel = async (
    guildId: GuildId,
    identifier: string,
  ): Promise<ManagedChannelRecord | null> => {
    const snapshot = await getGuildChannels(guildId);
    const byId = snapshot.managed[identifier];
    if (byId) return byId;
    return (
      Object.values(snapshot.managed).find(
        (entry) => entry.label === identifier,
      ) ?? null
    );
  };

  const addGuildManagedChannel = async (
    guildId: GuildId,
    input: ManagedChannelInput,
  ): Promise<ManagedChannelRecord> => {
    let createdId = "";
    const snapshot = await writeChannels(guildId, (current) => {
      const managed = deepClone(current.managed);
      createdId = generateManagedChannelId(input.label, managed);
      managed[createdId] = {
        id: createdId,
        label: input.label,
        channelId: input.channelId,
      };
      return {
        ...current,
        managed,
      };
    });
    const stored = snapshot.managed[createdId];
    if (!stored) {
      throw new Error(`Failed to store managed channel entry (id=${guildId})`);
    }
    return stored;
  };

  const updateGuildManagedChannel = async (
    guildId: GuildId,
    identifier: string,
    input: ManagedChannelUpdate,
  ): Promise<ManagedChannelRecord> => {
    const snapshot = await getGuildChannels(guildId);
    const resolvedKey = resolveManagedKey(snapshot.managed, identifier);
    if (!resolvedKey) {
      throw new Error(
        `Managed channel not found (id=${guildId}, identifier=${identifier})`,
      );
    }

    const updated = await writeChannels(guildId, (current) => {
      const managed = deepClone(current.managed);
      const existing = managed[resolvedKey];
      managed[resolvedKey] = {
        id: existing.id,
        label: input.label ?? existing.label,
        channelId: input.channelId ?? existing.channelId,
      };
      return {
        ...current,
        managed,
      };
    });
    const stored = updated.managed[resolvedKey];
    if (!stored) {
      throw new Error(
        `Managed channel update failed (id=${guildId}, identifier=${identifier})`,
      );
    }
    return stored;
  };

  const removeGuildManagedChannel = async (
    guildId: GuildId,
    identifier: string,
  ): Promise<boolean> => {
    let removed = false;
    await writeChannels(guildId, (current) => {
      const managed = deepClone(current.managed);
      const key = resolveManagedKey(managed, identifier);
      if (!key) return current;
      delete managed[key];
      removed = true;
      return {
        ...current,
        managed,
      };
    });
    return removed;
  };

  const writeRoles = async (
    guildId: GuildId,
    mutate: RolesMutator,
  ): Promise<GuildRolesRecord> => {
    const ensured = await ensureGuild(guildId);
    const current = deepClone(ensured.roles);
    const mutated = mutate(current);
    const next = deepClone(mutated);

    const updated = await runWithError(
      async () => {
        const [record] = await db
          .update(guilds)
          .set({
            roles: next,
            updatedAt: new Date(),
          })
          .where(eq(guilds.id, guildId))
          .returning();
        return record ?? null;
      },
      `Failed to update guild roles (id=${guildId})`,
    );
    if (!updated) {
      throw new Error(`Guild not found when updating roles (id=${guildId})`);
    }

    return deepClone(updated.roles);
  };

  const listGuildRoles = async (
    guildId: GuildId,
  ): Promise<ManagedRoleSnapshot[]> => {
    const ensured = await ensureGuild(guildId);
    return toManagedRoleSnapshots(deepClone(ensured.roles));
  };

  const getGuildRole = async (
    guildId: GuildId,
    key: RoleKey,
  ): Promise<ManagedRoleSnapshot | null> => {
    const ensured = await ensureGuild(guildId);
    const roles = deepClone(ensured.roles);
    const record = roles[key];
    return record ? toManagedRoleSnapshot(key, record) : null;
  };

  const upsertGuildRole = async (
    guildId: GuildId,
    key: RoleKey,
    input: Partial<GuildRow["roles"][string]>,
  ): Promise<ManagedRoleSnapshot> => {
    const roles = await writeRoles(guildId, (current) => {
      const existing = current[key] ?? createEmptyRoleRecord(key);
      return {
        ...current,
        [key]: {
          ...existing,
          ...input,
          updatedAt: new Date().toISOString(),
        },
      };
    });
    const stored = roles[key];
    if (!stored) {
      throw new Error(`Role upsert failed (id=${guildId}, key=${key})`);
    }
    return toManagedRoleSnapshot(key, stored);
  };

  const removeGuildRole = async (
    guildId: GuildId,
    key: RoleKey,
  ): Promise<boolean> => {
    let removed = false;
    await writeRoles(guildId, (current) => {
      if (!current[key]) return current;
      removed = true;
      const { [key]: _removed, ...rest } = current;
      return rest;
    });
    return removed;
  };

  const getGuildRoleOverrides = async (
    guildId: GuildId,
    key: RoleKey,
  ): Promise<Record<ActionName, OverrideValue>> => {
    const role = await getGuildRole(guildId, key);
    return role ? { ...(role.overrides ?? {}) } : {};
  };

  const setGuildRoleOverride = async (
    guildId: GuildId,
    key: RoleKey,
    action: ActionName,
    value: OverrideValue,
  ): Promise<void> => {
    await writeRoles(guildId, (current) => {
      const existing = current[key] ?? createEmptyRoleRecord(key);
      return {
        ...current,
        [key]: {
          ...existing,
          reach: {
            ...(existing.reach ?? {}),
            [normaliseActionName(action)]: value,
          },
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const resetGuildRoleOverrides = async (
    guildId: GuildId,
    key: RoleKey,
  ): Promise<ManagedRoleSnapshot> => {
    const roles = await writeRoles(guildId, (current) => {
      const existing = current[key] ?? createEmptyRoleRecord(key);
      return {
        ...current,
        [key]: {
          ...existing,
          reach: {},
          updatedAt: new Date().toISOString(),
        },
      };
    });
    const stored = roles[key];
    if (!stored) {
      throw new Error(`Role reset failed (id=${guildId}, key=${key})`);
    }
    return toManagedRoleSnapshot(key, stored);
  };

  const clearGuildRoleOverride = async (
    guildId: GuildId,
    key: RoleKey,
    action: ActionName,
  ): Promise<boolean> => {
    let removed = false;
    await writeRoles(guildId, (current) => {
      const existing = current[key] ?? createEmptyRoleRecord(key);
      if (!existing.reach) return current;
      const reach = { ...(existing.reach ?? {}) };
      const normalised = normaliseActionName(action);
      if (!reach[normalised]) return current;
      delete reach[normalised];
      removed = true;
      return {
        ...current,
        [key]: {
          ...existing,
          reach,
          updatedAt: new Date().toISOString(),
        },
      };
    });
    return removed;
  };

  const getGuildRoleLimits = async (
    guildId: GuildId,
    key: RoleKey,
  ): Promise<RoleLimitMap> => {
    const role = await getGuildRole(guildId, key);
    return role ? { ...(role.limits ?? {}) } : {};
  };

  const setGuildRoleLimit = async (
    guildId: GuildId,
    key: RoleKey,
    action: ActionName,
    limit: LimitDef,
  ): Promise<void> => {
    await writeRoles(guildId, (current) => {
      const existing = current[key] ?? createEmptyRoleRecord(key);
      const limits = { ...(existing.limits ?? {}) };
      limits[normaliseActionName(action)] = {
        limit: limit.limit,
        window: limit.window ?? null,
        windowSeconds: limit.windowSeconds ?? null,
      };
      return {
        ...current,
        [key]: {
          ...existing,
          limits,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const clearGuildRoleLimit = async (
    guildId: GuildId,
    key: RoleKey,
    action: ActionName,
  ): Promise<boolean> => {
    let removed = false;
    await writeRoles(guildId, (current) => {
      const existing = current[key] ?? createEmptyRoleRecord(key);
      if (!existing.limits) return current;
      const limits = { ...(existing.limits ?? {}) };
      const normalised = normaliseActionName(action);
      if (!limits[normalised]) return current;
      delete limits[normalised];
      removed = true;
      return {
        ...current,
        [key]: {
          ...existing,
          limits,
          updatedAt: new Date().toISOString(),
        },
      };
    });
    return removed;
  };

  return {
    getGuild,
    createGuild,
    ensureGuild,
    updateGuild,
    removeGuild,
    guildExists,
    getGuildChannels,
    getGuildCoreChannel,
    setGuildCoreChannel,
    setGuildTicketCategory,
    listGuildManagedChannels,
    findGuildManagedChannel,
    addGuildManagedChannel,
    updateGuildManagedChannel,
    removeGuildManagedChannel,
    listGuildRoles,
    getGuildRole,
    upsertGuildRole,
    removeGuildRole,
    setGuildRoleOverride,
    getGuildRoleOverrides,
    resetGuildRoleOverrides,
    clearGuildRoleOverride,
    setGuildRoleLimit,
    getGuildRoleLimits,
    clearGuildRoleLimit,
    setGuildTicketMessage,
  };
}
