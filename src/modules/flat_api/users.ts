import { eq } from "drizzle-orm";

import { users } from "@/schemas/user";

import {
  buildUserInsert,
  deepClone,
  normaliseUserRow,
  runWithError,
  sanitiseUpdate,
} from "./helpers";
import type {
  DatabaseClient,
  UserId,
  UserInit,
  UserRow,
  UserUpdate,
  WarnId,
  WarnRecord,
} from "./types";

type WarnsMutator = (current: WarnRecord[]) => WarnRecord[];

export function createUserApi(db: DatabaseClient) {
  const getUser = async (userId: UserId): Promise<UserRow | null> => {
    const row = await runWithError(
      async () => {
        const [record] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        return record ?? null;
      },
      `Failed to load user (id=${userId})`,
    );
    return row ? normaliseUserRow(row) : null;
  };

  const userExists = async (userId: UserId): Promise<boolean> =>
    runWithError(
      async () => {
        const [record] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        return !!record;
      },
      `Failed to check user existence (id=${userId})`,
    );

  const createUser = async (
    userId: UserId,
    init: UserInit = {},
    overwrite = false,
  ): Promise<UserRow> => {
    const insertValues = buildUserInsert(userId, init);

    if (overwrite) {
      const upserted = await runWithError(
        async () => {
          const [record] = await db
            .insert(users)
            .values(insertValues)
            .onConflictDoUpdate({
              target: users.id,
              set: {
                bank: insertValues.bank ?? 0,
                cash: insertValues.cash ?? 0,
                warns: insertValues.warns ?? [],
              },
            })
            .returning();
          return record ?? null;
        },
        `Failed to upsert user (id=${userId})`,
      );
      if (!upserted) {
        throw new Error(`Failed to upsert user (id=${userId})`);
      }
      return normaliseUserRow(upserted);
    }

    const inserted = await runWithError(
      async () => {
        const [record] = await db
          .insert(users)
          .values(insertValues)
          .onConflictDoNothing()
          .returning();
        return record ?? null;
      },
      `Failed to create user (id=${userId})`,
    );
    if (inserted) {
      return normaliseUserRow(inserted);
    }

    const fallback = await getUser(userId);
    if (!fallback) {
      throw new Error(`Failed to create user (id=${userId})`);
    }
    return fallback;
  };

  const ensureUser = async (
    userId: UserId,
    init: UserInit = {},
  ): Promise<UserRow> => {
    const existing = await getUser(userId);
    if (existing) {
      return existing;
    }
    return await createUser(userId, init, false);
  };

  const updateUser = async (
    userId: UserId,
    changes: UserUpdate,
  ): Promise<UserRow> => {
    const payload = sanitiseUpdate(changes);
    if (Object.keys(payload).length === 0) {
      const existing = await getUser(userId);
      if (!existing) {
        throw new Error(`User not found (id=${userId})`);
      }
      return existing;
    }

    if (payload.warns) {
      payload.warns = deepClone(payload.warns ?? []);
    }

    const updated = await runWithError(
      async () => {
        const [record] = await db
          .update(users)
          .set(payload)
          .where(eq(users.id, userId))
          .returning();
        return record ?? null;
      },
      `Failed to update user (id=${userId})`,
    );
    if (!updated) {
      throw new Error(`User not found during update (id=${userId})`);
    }

    return normaliseUserRow(updated);
  };

  const removeUser = async (userId: UserId): Promise<boolean> =>
    runWithError(
      async () => {
        const result = await db.delete(users).where(eq(users.id, userId));
        return (result.rowCount ?? 0) > 0;
      },
      `Failed to remove user (id=${userId})`,
    );

  const listUserWarns = async (
    userId: UserId,
  ): Promise<WarnRecord[]> => {
    const ensured = await ensureUser(userId);
    return deepClone(ensured.warns ?? []);
  };

  const writeWarns = async (
    userId: UserId,
    mutate: WarnsMutator,
  ): Promise<WarnRecord[]> => {
    const ensured = await ensureUser(userId);
    const current = deepClone(ensured.warns ?? []);
    const next = deepClone(mutate(current));

    const updated = await runWithError(
      async () => {
        const [record] = await db
          .update(users)
          .set({ warns: next })
          .where(eq(users.id, userId))
          .returning();
        return record ?? null;
      },
      `Failed to update warns (id=${userId})`,
    );
    if (!updated) {
      throw new Error(
        `User not found when updating warns (id=${userId})`,
      );
    }

    return deepClone(updated.warns ?? []);
  };

  const setUserWarns = async (
    userId: UserId,
    warns: WarnRecord[],
  ): Promise<WarnRecord[]> => writeWarns(userId, () => deepClone(warns));

  const addUserWarn = async (
    userId: UserId,
    warn: WarnRecord,
  ): Promise<WarnRecord[]> =>
    writeWarns(userId, (entries) => [...entries, warn]);

  const removeUserWarn = async (
    userId: UserId,
    warnId: WarnId,
  ): Promise<WarnRecord[]> =>
    writeWarns(userId, (entries) =>
      entries.filter((entry) => entry.warn_id !== warnId),
    );

  const clearUserWarns = async (userId: UserId): Promise<void> => {
    await writeWarns(userId, () => []);
  };

  return {
    getUser,
    ensureUser,
    createUser,
    updateUser,
    removeUser,
    userExists,
    listUserWarns,
    setUserWarns,
    addUserWarn,
    removeUserWarn,
    clearUserWarns,
  };
}
