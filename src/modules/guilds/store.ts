import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db as defaultDb } from "@/db";
import { guilds, type Guild } from "@/schemas/guild";

export type GuildDatabase = NodePgDatabase<Record<string, unknown>>;
export type GuildUpdate = Partial<Pick<Guild, "roles" | "channels">>;

function resolveDatabase(database?: GuildDatabase): GuildDatabase {
  return database ?? defaultDb;
}

export async function getGuild(
  guildId: string,
  database?: GuildDatabase,
): Promise<Guild | undefined> {
  const db = resolveDatabase(database);

  const [row] = await db
    .select()
    .from(guilds)
    .where(eq(guilds.id, guildId))
    .limit(1);

  return row;
}

export async function ensureGuild(
  guildId: string,
  database?: GuildDatabase,
): Promise<Guild> {
  const db = resolveDatabase(database);
  const existing = await getGuild(guildId, db);
  if (existing) return existing;

  await db
    .insert(guilds)
    .values({ id: guildId })
    .onConflictDoNothing();

  const created = await getGuild(guildId, db);
  if (!created) {
    throw new Error(`Guild ${guildId} could not be loaded or created`);
  }
  return created;
}

export async function updateGuild(
  guildId: string,
  patch: GuildUpdate,
  database?: GuildDatabase,
): Promise<void> {
  if (!patch || Object.keys(patch).length === 0) {
    return;
  }

  const db = resolveDatabase(database);

  await db
    .update(guilds)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(guilds.id, guildId));
}
