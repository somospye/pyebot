import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { CoreChannelName } from "@/modules/guild-channels/constants";
import type {
  CoreChannelRecord,
  GuildChannelsRecord,
  GuildRoleRecord,
  GuildRolesRecord,
  ManagedChannelRecord,
  RoleCommandOverride,
  RoleLimitMap,
  RoleLimitRecord,
} from "@/schemas/guild";
import type { Warn } from "@/schemas/user";

type Brand<T, B extends string> = T & { readonly __brand: B };

export type DatabaseClient = typeof import("@/db").db;

export type GuildId = Brand<string, "GuildId">;
export type ChannelId = Brand<string, "ChannelId">;
export type RoleId = Brand<string, "RoleId">;
export type UserId = Brand<string, "UserId">;

export const toGuildId = (value: string): GuildId => value as GuildId;
export const toChannelId = (value: string): ChannelId => value as ChannelId;
export const toRoleId = (value: string): RoleId => value as RoleId;
export const toUserId = (value: string): UserId => value as UserId;

type GuildTable = typeof import("@/schemas/guild").guilds;
type UserTable = typeof import("@/schemas/user").users;

export type GuildRow = InferSelectModel<GuildTable>;
export type GuildInsert = InferInsertModel<GuildTable>;
export type GuildInit = Partial<Omit<GuildInsert, "id">>;
export type GuildUpdate = Partial<Omit<GuildInsert, "id">>;

export type UserRow = InferSelectModel<UserTable>;
export type UserInsert = InferInsertModel<UserTable>;
export type UserInit = Partial<Omit<UserInsert, "id">>;
export type UserUpdate = Partial<Omit<UserInsert, "id">>;

export type WarnRecord = Warn;
export type WarnId = WarnRecord["warn_id"];

export type OverrideValue = RoleCommandOverride;
export type ActionName = string;
export type RoleKey = string;
export type LimitDef = RoleLimitRecord;

export type ManagedChannelInput = {
  label: string;
  channelId: ChannelId;
};

export type ManagedChannelUpdate = Partial<ManagedChannelInput>;

export type ManagedRoleSnapshot = {
  key: RoleKey;
  label: string;
  discordRoleId: RoleId | null;
  overrides: Record<ActionName, OverrideValue>;
  limits: RoleLimitMap;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type {
  CoreChannelName,
  CoreChannelRecord,
  GuildChannelsRecord,
  GuildRoleRecord,
  GuildRolesRecord,
  ManagedChannelRecord,
  RoleLimitMap,
};

export interface FlatDataStore {
  getGuild(guildId: GuildId): Promise<GuildRow | null>;
  createGuild(
    guildId: GuildId,
    init?: GuildInit,
    overwrite?: boolean,
  ): Promise<GuildRow>;
  ensureGuild(guildId: GuildId, init?: GuildInit): Promise<GuildRow>;
  updateGuild(guildId: GuildId, changes: GuildUpdate): Promise<GuildRow>;
  removeGuild(guildId: GuildId): Promise<boolean>;
  guildExists(guildId: GuildId): Promise<boolean>;

  getGuildChannels(guildId: GuildId): Promise<GuildChannelsRecord>;
  getGuildCoreChannel(
    guildId: GuildId,
    name: CoreChannelName,
  ): Promise<CoreChannelRecord | null>;
  setGuildCoreChannel(
    guildId: GuildId,
    name: CoreChannelName,
    channelId: ChannelId,
  ): Promise<CoreChannelRecord>;
  setGuildTicketCategory(
    guildId: GuildId,
    categoryId: ChannelId | null,
  ): Promise<ChannelId | null>;
  setGuildTicketMessage(
    guildId: GuildId,
    messageId: string | null,
  ): Promise<void>;
  listGuildManagedChannels(
    guildId: GuildId,
  ): Promise<ManagedChannelRecord[]>;
  findGuildManagedChannel(
    guildId: GuildId,
    identifier: string,
  ): Promise<ManagedChannelRecord | null>;
  addGuildManagedChannel(
    guildId: GuildId,
    input: ManagedChannelInput,
  ): Promise<ManagedChannelRecord>;
  updateGuildManagedChannel(
    guildId: GuildId,
    identifier: string,
    input: ManagedChannelUpdate,
  ): Promise<ManagedChannelRecord>;
  removeGuildManagedChannel(
    guildId: GuildId,
    identifier: string,
  ): Promise<boolean>;

  listGuildRoles(guildId: GuildId): Promise<ManagedRoleSnapshot[]>;
  getGuildRole(
    guildId: GuildId,
    key: RoleKey,
  ): Promise<ManagedRoleSnapshot | null>;
  upsertGuildRole(
    guildId: GuildId,
    key: RoleKey,
    input: Partial<GuildRoleRecord>,
  ): Promise<ManagedRoleSnapshot>;
  removeGuildRole(guildId: GuildId, key: RoleKey): Promise<boolean>;
  setGuildRoleOverride(
    guildId: GuildId,
    key: RoleKey,
    action: ActionName,
    value: OverrideValue,
  ): Promise<void>;
  getGuildRoleOverrides(
    guildId: GuildId,
    key: RoleKey,
  ): Promise<Record<ActionName, OverrideValue>>;
  resetGuildRoleOverrides(
    guildId: GuildId,
    key: RoleKey,
  ): Promise<ManagedRoleSnapshot>;
  clearGuildRoleOverride(
    guildId: GuildId,
    key: RoleKey,
    action: ActionName,
  ): Promise<boolean>;
  setGuildRoleLimit(
    guildId: GuildId,
    key: RoleKey,
    action: ActionName,
    limit: LimitDef,
  ): Promise<void>;
  getGuildRoleLimits(
    guildId: GuildId,
    key: RoleKey,
  ): Promise<RoleLimitMap>;
  clearGuildRoleLimit(
    guildId: GuildId,
    key: RoleKey,
    action: ActionName,
  ): Promise<boolean>;

  getUser(userId: UserId): Promise<UserRow | null>;
  ensureUser(userId: UserId, init?: UserInit): Promise<UserRow>;
  createUser(
    userId: UserId,
    init?: UserInit,
    overwrite?: boolean,
  ): Promise<UserRow>;
  updateUser(userId: UserId, changes: UserUpdate): Promise<UserRow>;
  removeUser(userId: UserId): Promise<boolean>;
  userExists(userId: UserId): Promise<boolean>;

  listUserWarns(userId: UserId): Promise<WarnRecord[]>;
  setUserWarns(userId: UserId, warns: WarnRecord[]): Promise<WarnRecord[]>;
  addUserWarn(userId: UserId, warn: WarnRecord): Promise<WarnRecord[]>;
  removeUserWarn(
    userId: UserId,
    warnId: WarnId,
  ): Promise<WarnRecord[]>;
  clearUserWarns(userId: UserId): Promise<void>;

  transaction<T>(fn: (store: FlatDataStore) => Promise<T>): Promise<T>;
}
