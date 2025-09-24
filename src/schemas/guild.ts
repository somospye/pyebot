import { jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { CoreChannelName } from "@/modules/guild-channels/constants";

/** Identifier for a capability we expose to managed roles. */
export type RoleCapabilityKey = string;

/** Format "N uses allowed each Y seconds". */
export interface RoleRateLimitRecord {
  uses: number;
  perSeconds: number;
}

export type RoleRateLimitMap = Record<RoleCapabilityKey, RoleRateLimitRecord | null>;

/** Persisted configuration for a guild role. */
export interface GuildRoleRecord {
  /** Discord role this configuration operates on. */
  roleId: string;
  /** Custom limitations applied over Discord permissions. */
  rateLimits: RoleRateLimitMap;
}

export type GuildRolesRecord = Record<string, GuildRoleRecord>;

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

/** Default payload used when bootstrapping the roles column. */
const EMPTY_ROLES: GuildRolesRecord = {};

/** Default payload used when bootstrapping the channels column. */
const EMPTY_CHANNELS: GuildChannelsRecord = {
  core: {} as Record<CoreChannelName, CoreChannelRecord>,
  managed: {},
};

export const guilds = pgTable("guilds", {
  id: varchar("id", { length: 50 }).primaryKey().notNull().unique(),
  roles: jsonb("roles").$type<GuildRolesRecord>().notNull().default(EMPTY_ROLES),
  channels: jsonb("channels").$type<GuildChannelsRecord>().notNull().default(EMPTY_CHANNELS),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Guild = InferSelectModel<typeof guilds>;
export type NewGuild = InferInsertModel<typeof guilds>;
