import { jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { CoreChannelName } from "@/modules/guild-channels/constants";

/** Identifier for a capability we expose to managed roles. */
export type RoleCapabilityKey = string;

export type RoleCommandOverride = "inherit" | "allow" | "deny";
export type RoleCommandOverrideMap = Record<RoleCapabilityKey, RoleCommandOverride>;

export const LIMIT_WINDOWS = ["10m", "1h", "6h", "24h", "7d"] as const;
export type LimitWindow = (typeof LIMIT_WINDOWS)[number];

export interface RoleLimitRecord {
  limit: number;
  window: LimitWindow | null;
  /** Optional precise window (in seconds) for backwards compatibility or future extensions. */
  windowSeconds?: number | null;
}

export type RoleLimitMap = Partial<Record<RoleCapabilityKey, RoleLimitRecord>>;

/** Persisted configuration for a guild role. */
export interface GuildRoleRecord {
  /** Stable human label shown in the dashboard. */
  label: string;
  /** Discord role this configuration operates on. */
  discordRoleId: string | null;
  /** Custom limitations applied over Discord permissions. */
  limits: RoleLimitMap;
  /** Overrides for allowing/denying moderation actions handled by the bot. */
  reach: RoleCommandOverrideMap;
  /** Last moderator updating the configuration. */
  updatedBy: string | null;
  /** Timestamp in ISO format representing the last update. */
  updatedAt: string | null;
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

