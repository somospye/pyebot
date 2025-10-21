import { roleRateLimiter } from "./rateLimiter";
import * as repo from "@/modules/repo";
import {
  type RoleCommandOverride,
  type RoleLimitRecord,
} from "@/schemas/guild";

export type { RoleCommandOverride } from "@/schemas/guild";

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

export interface ResolveRoleActionPermissionInput {
  guildId: string;
  actionKey: string;
  memberRoleIds: readonly string[];
  hasDiscordPermission: boolean;
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

export interface ConsumeRoleLimitsOptions {
  guildId: string;
  actionKey: string;
  memberRoleIds: readonly string[];
}

/* ------------------------------------------------------------------ */
/* Helpers to read role data from repo and normalize to snapshots      */
/* ------------------------------------------------------------------ */

interface RoleSnapshot {
  key: string;
  discordRoleId: string | null;
  overrides: Record<string, RoleCommandOverride>;
  limits: Record<string, RoleLimitRecord>;
}

function normaliseAction(action: string): string {
  const trimmed = action.trim().toLowerCase();
  if (!trimmed) throw new Error("Action key must be provided.");
  return trimmed;
}

function normaliseKey(k: string) {
  return k.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

async function listGuildRoleSnapshots(guildId: string): Promise<RoleSnapshot[]> {
  const rolesObj = await repo.readRoles(guildId); // JSON map: { [roleKey]: { discordRoleId?, reach/overrides?, limits? } }
  const entries = Object.entries(rolesObj ?? {});
  return entries.map(([key, rec]: [string, any]) => {
    const overrides = (rec?.overrides ?? rec?.reach ?? {}) as Record<
      string,
      RoleCommandOverride
    >;
    const limits = (rec?.limits ?? {}) as Record<string, RoleLimitRecord>;
    const discordRoleId =
      rec?.discordRoleId ??
      rec?.discord_role_id ??
      rec?.discordId ??
      rec?.id ??
      null;

    // normalize action keys so lookups are stable
    const normOverrides: Record<string, RoleCommandOverride> = {};
    for (const [ok, ov] of Object.entries(overrides)) {
      normOverrides[normaliseKey(ok)] = ov as RoleCommandOverride;
    }
    const normLimits: Record<string, RoleLimitRecord> = {};
    for (const [lk, lv] of Object.entries(limits)) {
      normLimits[normaliseKey(lk)] = lv as RoleLimitRecord;
    }

    return {
      key,
      discordRoleId,
      overrides: normOverrides,
      limits: normLimits,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Public APIs                                                         */
/* ------------------------------------------------------------------ */

/**
 * Retorna una descripcion legible de la ventana de un limite.
 * Ex. "10 minutes", "1 hour", "no-window", "inherit"
 */
export function describeWindow(limit: RoleLimitRecord | undefined): string {
  if (!limit) return "inherit";
  const windowSeconds = limit.windowSeconds;
  if (!windowSeconds || windowSeconds <= 0) return "no-window";

  const match = limit.window?.match(/^(\d+)(m|h|d)$/);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case "m":
        return `${value} minute${value !== 1 ? "s" : ""}`;
      case "h":
        return `${value} hour${value !== 1 ? "s" : ""}`;
      case "d":
        return `${value} day${value !== 1 ? "s" : ""}`;
    }
  }
  return `${windowSeconds}s`;
}

/**
 * Determines whether a member can execute a moderation action given the roles
 * configured in the DB via repo.
 */
export async function resolveRoleActionPermission({
  guildId,
  actionKey,
  memberRoleIds,
  hasDiscordPermission,
}: ResolveRoleActionPermissionInput): Promise<ResolveRoleActionPermissionResult> {
  if (!memberRoleIds.length) {
    return {
      allowed: hasDiscordPermission,
      decision: hasDiscordPermission ? "discord-allow" : "discord-deny",
    };
  }

  const roles = await listGuildRoleSnapshots(guildId);
  const action = normaliseAction(actionKey);
  const membership = new Set(memberRoleIds);

  let allowSource:
    | { roleKey: string; override: RoleCommandOverride }
    | undefined;

  for (const snapshot of roles) {
    if (!snapshot.discordRoleId || !membership.has(snapshot.discordRoleId)) {
      continue;
    }

    const override = snapshot.overrides[action];
    if (!override || override === "inherit") continue;

    if (override === "deny") {
      return {
        allowed: false,
        decision: "override-deny",
        roleKey: snapshot.key,
        override,
      };
    }

    if (!allowSource) {
      allowSource = { roleKey: snapshot.key, override };
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

/**
 * Applies configured rate limits for every managed role the member owns.
 * Returns either the applied buckets or the blocking constraint.
 */
export async function consumeRoleLimits({
  guildId,
  actionKey,
  memberRoleIds,
}: ConsumeRoleLimitsOptions): Promise<ConsumeLimitResult> {
  if (!memberRoleIds.length) {
    return { allowed: true, applied: [] };
  }

  const roles = await listGuildRoleSnapshots(guildId);
  const action = normaliseAction(actionKey);
  const membership = new Set(memberRoleIds);

  const consumed: Array<{
    key: string;
    roleKey: string;
    usage: RoleLimitUsage;
  }> = [];

  for (const snapshot of roles) {
    if (!snapshot.discordRoleId || !membership.has(snapshot.discordRoleId)) {
      continue;
    }

    const limit = snapshot.limits[action];
    if (!limit || !Number.isFinite(limit.limit) || limit.limit <= 0) continue;

    const windowSeconds = limit.windowSeconds;
    if (!windowSeconds || windowSeconds <= 0) continue;

    const bucketKey = `${guildId}:${snapshot.key}:${action}`;
    const outcome = roleRateLimiter.consume(
      bucketKey,
      Math.max(0, Math.floor(limit.limit)),
      windowSeconds,
    );

    if (!outcome.allowed) {
      for (const entry of consumed) roleRateLimiter.rollback(entry.key);

      return {
        allowed: false,
        violation: {
          roleKey: snapshot.key,
          limit,
          windowSeconds,
          remaining: outcome.remaining ?? 0,
          resetAt: outcome.resetAt ?? Date.now(),
        },
      };
    }

    consumed.push({
      key: bucketKey,
      roleKey: snapshot.key,
      usage: {
        roleKey: snapshot.key,
        limit,
        windowSeconds,
        remaining: outcome.remaining ?? 0,
        resetAt: outcome.resetAt ?? Date.now(),
      },
    });
  }

  return {
    allowed: true,
    applied: consumed.map((e) => e.usage),
  };
}
