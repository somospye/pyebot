import { jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { CoreChannelName } from "@/modules/guild-channels/constants";

/** Persisted shape for a required channel entry. */
export interface CoreChannelRecord {
  name: CoreChannelName;
  label: string;
  channelId: string;
}

/** Persisted shape for staff-configured optional channels. */
export interface ManagedChannelRecord {
  id: string;
  label: string;
  channelId: string;
}

export interface GuildChannelsRecord {
  core: Record<CoreChannelName, CoreChannelRecord>;
  managed: Record<string, ManagedChannelRecord>;
}

/** Default payload used when bootstrapping a new guild row. */
const EMPTY_CHANNELS: GuildChannelsRecord = {
  core: {} as Record<CoreChannelName, CoreChannelRecord>,
  managed: {},
};

export const guilds = pgTable("guilds", {
  id: varchar("id", { length: 50 }).primaryKey().notNull().unique(),
  channels: jsonb("channels").$type<GuildChannelsRecord>().notNull().default(EMPTY_CHANNELS),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Guild = InferSelectModel<typeof guilds>;
export type NewGuild = InferInsertModel<typeof guilds>;
