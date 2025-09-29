import "module-alias/register";

import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import { createSession, expireSession, handleDashboardAction, renderSession, setDashboardAdapters } from "./state";
import type { DashboardAction } from "./state";
import type { GuildRoleRecord, GuildRolesRecord } from "@/schemas/guild";
import { roleRateLimiter } from "../../modules/guild-roles/rateLimiter";
import { isAuthorized } from "@/commands/roles/dashboard.command";
import type { GuildCommandContext } from "seyfert";

const TEST_GUILD_ID = "guild-1";
const MODERATOR_ID = "mod-123";

type RolesStore = Map<string, GuildRolesRecord>;

const store: RolesStore = new Map();
const sessions: ReturnType<typeof createSession>[] = [];

beforeEach(() => {
  if (!store.has(TEST_GUILD_ID)) {
    store.set(TEST_GUILD_ID, {});
  }

  const fakeGetGuildRoles = async (guildId: string) => {
    const roles = store.get(guildId) ?? {};
    return cloneRoles(roles);
  };

  const fakeUpsertRole = async (
    guildId: string,
    input: {
      key: string;
      label?: string;
      discordRoleId?: string | null;
      limits?: GuildRoleRecord["limits"];
      reach?: GuildRoleRecord["reach"];
    },
    _database?: unknown,
  ) => {
    const roles = store.get(guildId) ?? {};
    const next: GuildRoleRecord = {
      label: input.label ?? input.key,
      discordRoleId: input.discordRoleId ?? null,
      limits: cloneLimits(input.limits ?? {}),
      reach: { ...(input.reach ?? {}) },
      updatedBy: MODERATOR_ID,
      updatedAt: new Date().toISOString(),
    };
    roles[input.key] = next;
    store.set(guildId, roles);

    return { key: input.key, record: cloneRole(next) };
  };

  setDashboardAdapters({
    getGuildRoles: fakeGetGuildRoles,
    upsertRole: fakeUpsertRole,
  });
});

afterEach(() => {
  for (const session of sessions.splice(0, sessions.length)) {
    expireSession(session.id);
  }
  roleRateLimiter.rollback(`${TEST_GUILD_ID}:role:action`);
  store.clear();
});

test("isAuthorized denies users without roles or permissions", async () => {
  process.env.ROLES_DASHBOARD_ALLOWED_ROLES = "role-allowed";
  const ctx = createMockContext({
    guildId: TEST_GUILD_ID,
    memberRoles: [],
    manageGuild: false,
  });

  const allowed = await isAuthorized(ctx);
  assert.equal(allowed, false);
});

test("map confirm updates persisted role", async () => {
  store.set(TEST_GUILD_ID, {
    mod: {
      label: "Moderadores",
      discordRoleId: "old",
      limits: {},
      reach: {},
      updatedBy: null,
      updatedAt: null,
    },
  });

  const session = newSession();

  await handle("select_role", session, ["mod"]);
  await handle("open_option", session, ["map"]);
  await handle("map_select", session, ["new-role"]);
  await handle("map_confirm", session);
  await handle("save_confirm", session);

  const persisted = store.get(TEST_GUILD_ID)?.mod;
  assert.ok(persisted);
  assert.equal(persisted?.discordRoleId, "new-role");
});

test("limits enforce max uses", async () => {
  store.set(TEST_GUILD_ID, {
    mod: {
      label: "Moderadores",
      discordRoleId: "role-a",
      limits: {},
      reach: {},
      updatedBy: null,
      updatedAt: null,
    },
  });

  const session = newSession();

  await handle("select_role", session, ["mod"]);
  await handle("open_option", session, ["limits"]);
  await handle("set_limit", session, [], { actionKey: "ban", limitValue: "3", windowValue: "24h" });
  await handle("limits_apply", session);
  await handle("save_confirm", session);

  const key = `${TEST_GUILD_ID}:mod:ban`;
  for (let i = 0; i < 3; i++) {
    const result = roleRateLimiter.consume(key, 3, 24 * 60 * 60);
    assert.equal(result.allowed, true);
  }
  const blocked = roleRateLimiter.consume(key, 3, 24 * 60 * 60);
  assert.equal(blocked.allowed, false);
});

test("reach deny takes precedence", async () => {
  store.set(TEST_GUILD_ID, {
    mod: {
      label: "Moderadores",
      discordRoleId: "role-a",
      limits: {},
      reach: {},
      updatedBy: null,
      updatedAt: null,
    },
  });

  const session = newSession();

  await handle("select_role", session, ["mod"]);
  await handle("open_option", session, ["reach"]);
  await handle("reach_select_command", session, ["ban"]);
  await handle("reach_select_override", session, ["deny"]);
  await handle("reach_apply", session);
  await handle("save_confirm", session);

  const persisted = store.get(TEST_GUILD_ID)?.mod;
  assert.ok(persisted);
  assert.equal(persisted?.reach?.["ban"], "deny");
});

test("rename validation blocks long names", async () => {
  store.set(TEST_GUILD_ID, {
    mod: {
      label: "Moderadores",
      discordRoleId: "role-a",
      limits: {},
      reach: {},
      updatedBy: null,
      updatedAt: null,
    },
  });

  const session = newSession();

  await handle("select_role", session, ["mod"]);
  const result = await handle("rename_confirm", session, [], {
    label: "x".repeat(40),
  });

  assert.ok(result.error);
});

test("expired session shows expired view", async () => {
  store.set(TEST_GUILD_ID, {
    mod: {
      label: "Moderadores",
      discordRoleId: "role-a",
      limits: {},
      reach: {},
      updatedBy: null,
      updatedAt: null,
    },
  });

  const session = newSession();

  expireSession(session.id);
  const result = await handle("select_role", session, ["mod"]);
  assert.equal(result.error, "La sesion ha expirado. Usa Reabrir para continuar.");

  const view = renderSession(session);
  assert.ok(view.embeds[0]?.toJSON().title?.includes("Sesion expirada"));
});

function createMockContext({
  guildId,
  memberRoles,
  manageGuild,
}: {
  guildId: string;
  memberRoles: string[];
  manageGuild: boolean;
}): GuildCommandContext {
  return {
    guildId,
    member: {
      roles: {
        list: async () => memberRoles.map((id) => ({ id })),
      },
      permissions: {
        has: (permission: unknown) => (permission ? manageGuild : false),
      },
    },
  } as unknown as GuildCommandContext;
}

function newSession(): ReturnType<typeof createSession> {
  const session = createSession({
    guildId: TEST_GUILD_ID,
    moderatorId: MODERATOR_ID,
    roles: cloneRoles(store.get(TEST_GUILD_ID) ?? {}),
  });
  sessions.push(session);
  return session;
}

async function handle(
  action: DashboardAction,
  session: ReturnType<typeof createSession>,
  values: readonly string[] = [],
  data?: Record<string, unknown>,
) {
  return await handleDashboardAction({
    session,
    action,
    actorId: MODERATOR_ID,
    values,
    data,
  });
}

function cloneRoles(roles: GuildRolesRecord): GuildRolesRecord {
  const copy: GuildRolesRecord = {};
  for (const [key, record] of Object.entries(roles)) {
    copy[key] = cloneRole(record);
  }
  return copy;
}

function cloneRole(record: GuildRoleRecord): GuildRoleRecord {
  return {
    label: record.label,
    discordRoleId: record.discordRoleId,
    limits: cloneLimits(record.limits ?? {}),
    reach: { ...(record.reach ?? {}) },
    updatedBy: record.updatedBy,
    updatedAt: record.updatedAt,
  };
}

function cloneLimits(limits: GuildRoleRecord["limits"]): GuildRoleRecord["limits"] {
  const copy: GuildRoleRecord["limits"] = {};
  for (const [key, limit] of Object.entries(limits ?? {})) {
    if (!limit) continue;
    copy[key] = { ...limit };
  }
  return copy;
}
import "module-alias/register";
