import {
  ensureGuild,
  updateGuild,
  type GuildDatabase,
} from "@/modules/guilds/store";

import {
  LIMIT_WINDOWS,
  type GuildRoleRecord,
  type GuildRolesRecord,
  type LimitWindow,
  type RoleCommandOverride,
  type RoleLimitRecord,
} from "@/schemas/guild";

import { roleRateLimiter } from "./rateLimiter";

export type { RoleCommandOverride } from "@/schemas/guild";

const WINDOW_SECONDS: Record<LimitWindow, number> = Object.freeze({
  "10m": 10 * 60,
  "1h": 60 * 60,
  "6h": 6 * 60 * 60,
  "24h": 24 * 60 * 60,
  "7d": 7 * 24 * 60 * 60,
});

const LIMIT_WINDOW_SET = new Set<LimitWindow>(LIMIT_WINDOWS);

function toOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function sanitizeLabel(value: unknown, fallback: string): string {
  const resolved = toOptionalString(value) ?? fallback;
  return resolved.slice(0, 32);
}

type LegacyRoleRateLimitRecord = {
  uses: number;
  perSeconds: number;
};

type LegacyRoleRecord = {
  roleId: string;
  rateLimits: Record<string, LegacyRoleRateLimitRecord | null>;
  commandOverrides: Record<string, RoleCommandOverride>;
  label?: string | null;
};

type MaybeLegacyRecord = LegacyRoleRecord | GuildRoleRecord;

function isLegacyRecord(record: unknown): record is LegacyRoleRecord {
  if (!record || typeof record !== "object") return false;
  return "rateLimits" in record && !("limits" in record);
}

function isRoleRecord(record: unknown): record is GuildRoleRecord {
  if (!record || typeof record !== "object") return false;
  return "limits" in record && "reach" in record;
}

function cloneLimits(
  source?: GuildRoleRecord["limits"],
): GuildRoleRecord["limits"] {
  return JSON.parse(JSON.stringify(source ?? {})) as GuildRoleRecord["limits"];
}

function cloneReach(
  source?: GuildRoleRecord["reach"],
): GuildRoleRecord["reach"] {
  return JSON.parse(JSON.stringify(source ?? {})) as GuildRoleRecord["reach"];
}

function cloneRoleRecord(record: GuildRoleRecord): GuildRoleRecord {
  return {
    label: record.label,
    discordRoleId: record.discordRoleId ?? null,
    limits: cloneLimits(record.limits),
    reach: cloneReach(record.reach),
    updatedBy: record.updatedBy ?? null,
    updatedAt: record.updatedAt ?? null,
  };
}

function resolveWindow(seconds: number | null | undefined): {
  window: LimitWindow | null;
  seconds: number | null;
} {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) {
    return { window: null, seconds: null };
  }

  const normalized = Math.floor(seconds);

  for (const entry of LIMIT_WINDOWS) {
    const value = WINDOW_SECONDS[entry];
    if (normalized === value) {
      return { window: entry, seconds: normalized };
    }
  }

  for (const entry of LIMIT_WINDOWS) {
    const value = WINDOW_SECONDS[entry];
    if (normalized <= value) {
      return { window: entry, seconds: normalized };
    }
  }

  return {
    window: LIMIT_WINDOWS[LIMIT_WINDOWS.length - 1] ?? null,
    seconds: normalized,
  };
}

function normalizeCommandOverride(value: unknown): RoleCommandOverride | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase();
  if (
    normalized === "inherit" ||
    normalized === "allow" ||
    normalized === "deny"
  ) {
    return normalized;
  }
  return undefined;
}

function normalizeLimitEntry(value: unknown): RoleLimitRecord | undefined {
  if (!value || typeof value !== "object") return undefined;

  if ("uses" in value && "perSeconds" in value) {
    const legacy = value as LegacyRoleRateLimitRecord;
    const limit = Number.isFinite(legacy.uses)
      ? Math.max(0, Math.floor(legacy.uses))
      : 0;
    const windowSeconds = Number.isFinite(legacy.perSeconds)
      ? Math.max(0, Math.floor(legacy.perSeconds))
      : 0;
    const { window, seconds } = resolveWindow(windowSeconds || null);
    return {
      limit,
      window,
      windowSeconds: windowSeconds || seconds,
    };
  }

  const candidate = value as Partial<RoleLimitRecord>;

  const limit = Number.isFinite(candidate.limit)
    ? Math.max(0, Math.floor(candidate.limit!))
    : 0;

  let window: LimitWindow | null = null;
  if (typeof candidate.window === "string") {
    const maybeWindow = candidate.window as LimitWindow;
    if (LIMIT_WINDOW_SET.has(maybeWindow)) {
      window = maybeWindow;
    }
  }

  const windowSeconds = Number.isFinite(candidate.windowSeconds ?? null)
    ? Math.max(0, Math.floor((candidate.windowSeconds ?? 0)!))
    : null;

  if (window === null) {
    const { window: resolvedWindow } = resolveWindow(windowSeconds ?? null);
    window = resolvedWindow;
  }

  if (limit < 0) return undefined;

  return {
    limit,
    window,
    windowSeconds: windowSeconds ?? (window ? WINDOW_SECONDS[window] : null),
  };
}

function normalizeReach(value: unknown): GuildRoleRecord["reach"] {
  if (!value || typeof value !== "object") return {};
  const reach: GuildRoleRecord["reach"] = {};

  for (const [key, override] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizeCommandOverride(override);
    if (!normalized) continue;
    reach[key] = normalized;
  }

  return reach;
}

function normalizeLimits(value: unknown): GuildRoleRecord["limits"] {
  if (!value || typeof value !== "object") return {};
  const limits: GuildRoleRecord["limits"] = {};

  for (const [action, limit] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizeLimitEntry(limit);
    if (!normalized) continue;
    limits[action] = normalized;
  }

  return limits;
}

function upgradeLegacyRecord(
  roleKey: string,
  record: LegacyRoleRecord,
): GuildRoleRecord {
  const limits: GuildRoleRecord["limits"] = {};

  for (const [action, value] of Object.entries(record.rateLimits ?? {})) {
    if (value === null) {
      limits[action] = {
        limit: 0,
        window: null,
        windowSeconds: null,
      };
      continue;
    }

    const normalized = normalizeLimitEntry(value);
    if (!normalized) continue;
    limits[action] = normalized;
  }

  const reach: GuildRoleRecord["reach"] = {};
  for (const [action, override] of Object.entries(
    record.commandOverrides ?? {},
  )) {
    const normalized = normalizeCommandOverride(override);
    if (!normalized) continue;
    reach[action] = normalized;
  }

  const label = sanitizeLabel(record.label, roleKey);
  const discordRoleId = toOptionalString(record.roleId);

  return {
    label,
    discordRoleId,
    limits,
    reach,
    updatedBy: null,
    updatedAt: null,
  };
}

function normalizeRoleRecord(
  roleKey: string,
  value: MaybeLegacyRecord,
): { record: GuildRoleRecord; changed: boolean } {
  if (isLegacyRecord(value)) {
    return { record: upgradeLegacyRecord(roleKey, value), changed: true };
  }

  const current = value as Partial<GuildRoleRecord> | undefined;
  const rawLimits = current?.limits ?? {};
  const rawReach = current?.reach ?? {};
  const limits = normalizeLimits(rawLimits);
  const reach = normalizeReach(rawReach);

  const rawLabel = typeof current?.label === "string" ? current.label : undefined;
  const label = sanitizeLabel(rawLabel, roleKey);

  const rawDiscordRoleId = typeof current?.discordRoleId === "string"
    ? current.discordRoleId
    : undefined;
  const discordRoleId = toOptionalString(rawDiscordRoleId);

  const rawUpdatedBy = typeof current?.updatedBy === "string" ? current.updatedBy : undefined;
  const updatedBy = toOptionalString(rawUpdatedBy);

  const rawUpdatedAt = typeof current?.updatedAt === "string" ? current.updatedAt : undefined;
  const updatedAt = toOptionalString(rawUpdatedAt);

  const record: GuildRoleRecord = {
    label,
    discordRoleId,
    limits,
    reach,
    updatedBy,
    updatedAt,
  };

  const limitsChanged = JSON.stringify(rawLimits ?? {}) !== JSON.stringify(limits);
  const reachChanged = JSON.stringify(rawReach ?? {}) !== JSON.stringify(reach);

  const labelChanged = rawLabel === undefined ? label !== roleKey : label !== rawLabel;
  const discordChanged = toOptionalString(rawDiscordRoleId) !== discordRoleId;
  const updatedByChanged = toOptionalString(rawUpdatedBy) !== updatedBy;
  const updatedAtChanged = toOptionalString(rawUpdatedAt) !== updatedAt;

  const changed =
    !isRoleRecord(value) ||
    limitsChanged ||
    reachChanged ||
    labelChanged ||
    discordChanged ||
    updatedByChanged ||
    updatedAtChanged;

  return { record, changed };
}

function normalizeRolesRecord(
  source?: GuildRolesRecord | Record<string, MaybeLegacyRecord> | null,
): { roles: GuildRolesRecord; changed: boolean } {
  if (!source) return { roles: {}, changed: false };

  const roles: GuildRolesRecord = {};
  let changed = false;

  for (const [key, record] of Object.entries(source)) {
    const normalized = normalizeRoleRecord(key, record);
    roles[key] = normalized.record;
    if (normalized.changed) changed = true;
  }

  return { roles, changed };
}

async function readRoles(
  guildId: string,
  database?: GuildDatabase,
): Promise<GuildRolesRecord> {
  const guild = await ensureGuild(guildId, database);
  const { roles, changed } = normalizeRolesRecord(guild.roles);

  if (changed) {
    await updateGuild(guildId, { roles }, database);
  }

  const clone: GuildRolesRecord = {};
  for (const [key, record] of Object.entries(roles)) {
    clone[key] = cloneRoleRecord(record);
  }

  return clone;
}

async function writeRoles(
  guildId: string,
  roles: GuildRolesRecord,
  database?: GuildDatabase,
): Promise<GuildRolesRecord> {
  await updateGuild(guildId, { roles }, database);

  const clone: GuildRolesRecord = {};
  for (const [key, record] of Object.entries(roles)) {
    clone[key] = cloneRoleRecord(record);
  }

  return clone;
}

function normalizeKey(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) throw new Error("Role key cannot be empty");
  return trimmed;
}

function coerceLabel(label: string | undefined, fallback: string): string {
  return sanitizeLabel(label, fallback);
}

function ensureIsoTimestamp(
  next?: string | Date | null,
  fallback?: string | null,
): string {
  const attempt = (candidate?: string | Date | null): string | null => {
    if (!candidate) return null;
    if (candidate instanceof Date) {
      return candidate.toISOString();
    }
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (!trimmed) return null;
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
    return null;
  };

  return attempt(next) ?? attempt(fallback) ?? new Date().toISOString();
}

export interface UpsertRoleInput {
  key: string;
  label?: string;
  discordRoleId?: string | null;
  limits?: GuildRoleRecord["limits"];
  reach?: GuildRoleRecord["reach"];
  updatedBy?: string | null;
  updatedAt?: string | Date | null;
}

export interface RoleConfig {
  roleKey: string;
  record: GuildRoleRecord;
}

export interface RoleLimitUsage {
  roleKey: string;
  limit: RoleLimitRecord;
  windowSeconds: number;
  remaining: number;
  resetAt: number;
}

export interface RoleLimitBlock {
  roleKey: string;
  limit: RoleLimitRecord;
  windowSeconds: number;
  remaining: number;
  resetAt: number;
}

export type ConsumeLimitResult =
  | { allowed: true; applied: RoleLimitUsage[] }
  | { allowed: false; violation: RoleLimitBlock };

export interface ModerationActionDefinition {
  key: string;
  label: string;
}

export const DEFAULT_MODERATION_ACTIONS: readonly ModerationActionDefinition[] =
  Object.freeze([
    { key: "timeout", label: "Timeout" },
    { key: "kick", label: "Kick" },
    { key: "ban", label: "Ban" },
    { key: "warn", label: "Warn" },
    { key: "purge", label: "Purge" },
  ]);

export async function getGuildRoles(
  guildId: string,
  database?: GuildDatabase,
): Promise<GuildRolesRecord> {
  return await readRoles(guildId, database);
}

export async function upsertRole(
  guildId: string,
  input: UpsertRoleInput,
  database?: GuildDatabase,
): Promise<{ key: string; record: GuildRoleRecord }> {
  const key = normalizeKey(input.key);

  const roles = await readRoles(guildId, database);
  const current = roles[key];

  const nextRecord: GuildRoleRecord = {
    label: coerceLabel(
      typeof input.label === "string" ? input.label : current?.label,
      current?.label ?? key,
    ),
    discordRoleId:
      input.discordRoleId !== undefined
        ? toOptionalString(input.discordRoleId)
        : toOptionalString(current?.discordRoleId),
    limits:
      input.limits !== undefined
        ? normalizeLimits(input.limits)
        : cloneLimits(current?.limits),
    reach:
      input.reach !== undefined
        ? normalizeReach(input.reach)
        : cloneReach(current?.reach),
    updatedBy:
      input.updatedBy !== undefined
        ? toOptionalString(input.updatedBy)
        : toOptionalString(current?.updatedBy),
    updatedAt: ensureIsoTimestamp(input.updatedAt ?? null, current?.updatedAt ?? null),
  };

  roles[key] = nextRecord;

  const saved = await writeRoles(guildId, roles, database);

  return { key, record: saved[key]! };
}

export async function removeRole(
  guildId: string,
  roleKey: string,
  database?: GuildDatabase,
): Promise<boolean> {
  const roles = await readRoles(guildId, database);
  if (!roles[roleKey]) return false;

  delete roles[roleKey];
  await writeRoles(guildId, roles, database);
  return true;
}

export async function saveRoleLimit(
  guildId: string,
  roleKey: string,
  actionKey: string,
  limit: RoleLimitRecord | null,
  database?: GuildDatabase,
): Promise<GuildRoleRecord> {
  const roles = await readRoles(guildId, database);
  const record = roles[roleKey];

  if (!record) {
    throw new Error(`Role configuration ${roleKey} does not exist`);
  }

  const limits = cloneLimits(record.limits);

  if (!limit) {
    delete limits[actionKey];
  } else {
    limits[actionKey] = normalizeLimitEntry(limit) ?? {
      limit: 0,
      window: null,
      windowSeconds: null,
    };
  }

  const nextRecord: GuildRoleRecord = {
    ...cloneRoleRecord(record),
    limits,
  };

  roles[roleKey] = nextRecord;
  const saved = await writeRoles(guildId, roles, database);

  return saved[roleKey]!;
}

export async function clearRoleLimit(
  guildId: string,
  roleKey: string,
  actionKey: string,
  database?: GuildDatabase,
): Promise<GuildRoleRecord> {
  const roles = await readRoles(guildId, database);
  const record = roles[roleKey];
  if (!record) {
    throw new Error(`Role configuration ${roleKey} does not exist`);
  }

  if (!(actionKey in record.limits)) {
    return record;
  }

  const limits = cloneLimits(record.limits);
  delete limits[actionKey];

  const nextRecord: GuildRoleRecord = {
    ...cloneRoleRecord(record),
    limits,
  };

  roles[roleKey] = nextRecord;
  const saved = await writeRoles(guildId, roles, database);

  return saved[roleKey]!;
}

export async function getRoleLimit(
  guildId: string,
  roleKey: string,
  actionKey: string,
  database?: GuildDatabase,
): Promise<RoleLimitRecord | undefined> {
  const roles = await readRoles(guildId, database);
  return roles[roleKey]?.limits[actionKey];
}

export async function listRoles(
  guildId: string,
  database?: GuildDatabase,
): Promise<RoleConfig[]> {
  const roles = await readRoles(guildId, database);

  return Object.entries(roles).map(([roleKey, record]) => ({
    roleKey,
    record: cloneRoleRecord(record),
  }));
}

export async function getRoleOverride(
  guildId: string,
  roleKey: string,
  actionKey: string,
  database?: GuildDatabase,
): Promise<RoleCommandOverride> {
  const roles = await readRoles(guildId, database);
  const record = roles[roleKey];
  if (!record) return "inherit";
  return record.reach[actionKey] ?? "inherit";
}

export async function listRoleOverrides(
  guildId: string,
  roleKey: string,
  database?: GuildDatabase,
): Promise<Record<string, RoleCommandOverride>> {
  const roles = await readRoles(guildId, database);
  const record = roles[roleKey];
  if (!record) return {};
  return cloneReach(record.reach);
}

export async function setRoleOverride(
  guildId: string,
  roleKey: string,
  actionKey: string,
  override: RoleCommandOverride,
  database?: GuildDatabase,
): Promise<GuildRoleRecord> {
  const roles = await readRoles(guildId, database);
  const record = roles[roleKey];
  if (!record) {
    throw new Error(`Role configuration ${roleKey} does not exist`);
  }

  const reach = cloneReach(record.reach);

  if (override === "inherit") {
    delete reach[actionKey];
  } else {
    reach[actionKey] = override;
  }

  const nextRecord: GuildRoleRecord = {
    ...cloneRoleRecord(record),
    reach,
  };

  roles[roleKey] = nextRecord;
  const saved = await writeRoles(guildId, roles, database);

  return saved[roleKey]!;
}

export async function resetRoleOverrides(
  guildId: string,
  roleKey: string,
  database?: GuildDatabase,
): Promise<GuildRoleRecord> {
  const roles = await readRoles(guildId, database);
  const record = roles[roleKey];
  if (!record) {
    throw new Error(`Role configuration ${roleKey} does not exist`);
  }

  const nextRecord: GuildRoleRecord = {
    ...cloneRoleRecord(record),
    reach: {},
  };

  roles[roleKey] = nextRecord;
  const saved = await writeRoles(guildId, roles, database);

  return saved[roleKey]!;
}

function getWindowSeconds(limit: RoleLimitRecord | undefined): number | null {
  if (!limit) return null;
  if (
    typeof limit.windowSeconds === "number" &&
    Number.isFinite(limit.windowSeconds) &&
    limit.windowSeconds > 0
  ) {
    return Math.floor(limit.windowSeconds);
  }
  if (limit.window && WINDOW_SECONDS[limit.window]) {
    return WINDOW_SECONDS[limit.window];
  }
  return null;
}

export interface ResolveRoleActionPermissionInput {
  guildId: string;
  actionKey: string;
  memberRoleIds: readonly string[];
  hasDiscordPermission: boolean;
  database?: GuildDatabase;
}

export interface ResolveRoleActionPermissionResult {
  allowed: boolean;
  decision:
    | "override-allow"
    | "override-deny"
    | "discord-allow"
    | "discord-deny";
  roleKey?: string;
  override?: RoleCommandOverride;
}

export async function resolveRoleActionPermission({
  guildId,
  actionKey,
  memberRoleIds,
  hasDiscordPermission,
  database,
}: ResolveRoleActionPermissionInput): Promise<ResolveRoleActionPermissionResult> {
  if (!memberRoleIds.length) {
    return {
      allowed: hasDiscordPermission,
      decision: hasDiscordPermission ? "discord-allow" : "discord-deny",
    };
  }

  const roles = await readRoles(guildId, database);
  const roleIdSet = new Set(memberRoleIds);
  let allowSource:
    | { roleKey: string; override: RoleCommandOverride }
    | undefined;

  for (const [roleKey, record] of Object.entries(roles)) {
    if (!record.discordRoleId || !roleIdSet.has(record.discordRoleId)) continue;

    const override = record.reach[actionKey];
    if (!override || override === "inherit") continue;

    if (override === "deny") {
      return {
        allowed: false,
        decision: "override-deny",
        roleKey,
        override,
      };
    }

    if (!allowSource) {
      allowSource = { roleKey, override };
    }
  }

  if (allowSource) {
    return {
      allowed: true,
      decision: "override-allow",
      roleKey: allowSource.roleKey,
      override: allowSource.override,
    };
  }

  return {
    allowed: hasDiscordPermission,
    decision: hasDiscordPermission ? "discord-allow" : "discord-deny",
  };
}

export interface ConsumeRoleLimitsOptions {
  guildId: string;
  actionKey: string;
  memberRoleIds: readonly string[];
  database?: GuildDatabase;
}

export async function consumeRoleLimits({
  guildId,
  actionKey,
  memberRoleIds,
  database,
}: ConsumeRoleLimitsOptions): Promise<ConsumeLimitResult> {
  if (!memberRoleIds.length) {
    return { allowed: true, applied: [] };
  }

  const roles = await readRoles(guildId, database);
  const consumed: Array<{
    key: string;
    roleKey: string;
    result: RoleLimitUsage;
  }> = [];

  for (const [roleKey, record] of Object.entries(roles)) {
    if (!record.discordRoleId || !memberRoleIds.includes(record.discordRoleId)) {
      continue;
    }

    const limit = record.limits[actionKey];
    if (!limit) continue;

    if (!Number.isFinite(limit.limit) || limit.limit <= 0) {
      continue;
    }

    const windowSeconds = getWindowSeconds(limit);
    if (!windowSeconds || windowSeconds <= 0) {
      continue;
    }

    const bucketKey = `${guildId}:${roleKey}:${actionKey}`;
    const outcome = roleRateLimiter.consume(
      bucketKey,
      Math.max(0, Math.floor(limit.limit)),
      windowSeconds,
    );

    if (!outcome.allowed) {
      for (const entry of consumed) {
        roleRateLimiter.rollback(entry.key);
      }

      return {
        allowed: false,
        violation: {
          roleKey,
          limit,
          windowSeconds,
          remaining: outcome.remaining ?? 0,
          resetAt: outcome.resetAt ?? Date.now(),
        },
      };
    }

    const usage: RoleLimitUsage = {
      roleKey,
      limit,
      windowSeconds,
      remaining: outcome.remaining ?? 0,
      resetAt: outcome.resetAt ?? Date.now(),
    };

    consumed.push({ key: bucketKey, roleKey, result: usage });
  }

  return {
    allowed: true,
    applied: consumed.map((entry) => entry.result),
  };
}

export function describeWindow(limit: RoleLimitRecord | undefined): string {
  if (!limit) return "inherit";
  const windowSeconds = getWindowSeconds(limit);
  if (!windowSeconds || windowSeconds <= 0) {
    return "no-window";
  }

  const window = limit.window;
  if (window && WINDOW_SECONDS[window] === windowSeconds) {
    return window;
  }

  return `${windowSeconds}s`;
}
