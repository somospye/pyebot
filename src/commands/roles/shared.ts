import type { GuildCommandContext } from "seyfert";

import { getDB } from "@/modules/repo";
import type {
  FlatDataStore,
  GuildId,
  ManagedRoleSnapshot,
} from "@/modules/repo";
import {
  DEFAULT_MODERATION_ACTIONS,
  listRoles,
  type ModerationActionDefinition,
} from "@/modules/guild-roles";
import type {
  LimitWindow,
  RoleCommandOverride,
  RoleLimitRecord,
} from "@/schemas/guild";
import { GUILD_ONLY_MESSAGE } from "@/utils/commandGuards";

export const WINDOW_DESCRIPTIONS: Record<LimitWindow, string> = {
  "10m": "cada 10 minutos",
  "1h": "cada hora",
  "6h": "cada 6 horas",
  "24h": "cada 24 horas",
  "7d": "cada 7 dias",
};

const LIMIT_WINDOW_PATTERN = /^(\d+)(m|h|d)$/;

export interface ResolvedGuildContext {
  guildId: string;
  storeGuildId: GuildId;
  store: FlatDataStore;
}

export async function requireGuildContext(
  ctx: GuildCommandContext,
): Promise<ResolvedGuildContext | null> {
  if (!ctx.guildId) {
    await ctx.write({ content: GUILD_ONLY_MESSAGE });
    return null;
  }

  const store = getDB();
  const storeGuildId = ctx.guildId as GuildId;
  await store.ensureGuild(storeGuildId);
  return { guildId: ctx.guildId, storeGuildId, store };
}

export async function fetchManagedRoles(
  guildId: string,
): Promise<ManagedRoleSnapshot[]> {
  return await listRoles(guildId);
}

export async function findManagedRole(
  guildId: string,
  key: string,
): Promise<ManagedRoleSnapshot | null> {
  const roles = await fetchManagedRoles(guildId);
  return roles.find((role) => role.key === key) ?? null;
}

export interface ResolvedAction {
  definition: ModerationActionDefinition;
  key: string;
}

export function resolveActionInput(
  raw: string | undefined,
): { action: ResolvedAction } | { error: string } {
  if (!raw) {
    return { error: "Debes indicar una accion de moderacion." };
  }

  const normalised = raw.trim().toLowerCase();
  if (!normalised) {
    return { error: "Debes indicar una accion de moderacion." };
  }

  if (normalised.includes(".")) {
    return {
      error:
        "Formato de accion invalido. Usa nombres simples como `kick`, `ban`, `warn`, `timeout` o `purge`.",
    };
  }

  const action =
    DEFAULT_MODERATION_ACTIONS.find(
      (entry) =>
        entry.key === normalised || entry.label.toLowerCase() === normalised,
    ) ?? null;

  if (!action) {
    const available = DEFAULT_MODERATION_ACTIONS.map(
      (entry) => `\`${entry.key}\``,
    ).join(", ");

    return {
      error: `Accion desconocida. Opciones disponibles: ${available}.`,
    };
  }

  return { action: { definition: action, key: action.key } };
}

export interface ParsedLimitWindow {
  window: LimitWindow;
  seconds: number;
}

export function parseLimitWindowInput(
  input: string | undefined,
): ParsedLimitWindow | null {
  if (!input) return null;
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  const match = raw.match(LIMIT_WINDOW_PATTERN);
  if (!match) return null;

  const value = Number.parseInt(match[1], 10);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const unit = match[2];
  const multiplier = unit === "m" ? 60 : unit === "h" ? 3600 : 86400;
  const seconds = value * multiplier;

  return {
    window: raw as LimitWindow,
    seconds,
  };
}

export function limitWindowToSeconds(window: LimitWindow): number {
  const match = window.match(LIMIT_WINDOW_PATTERN);
  if (!match) {
    throw new Error(`Ventana invalida: ${window}`);
  }

  const value = Number.parseInt(match[1], 10);
  const unit = match[2];

  const multiplier = unit === "m" ? 60 : unit === "h" ? 3600 : 86400;
  return value * multiplier;
}

export function buildLimitRecord(
  limit: number,
  window: LimitWindow,
): RoleLimitRecord {
  return {
    limit: Math.max(0, Math.floor(limit)),
    window,
    windowSeconds: limitWindowToSeconds(window),
  };
}

export function formatOverrideValue(
  override: RoleCommandOverride | undefined,
): string {
  switch (override) {
    case "allow":
      return "Permitir";
    case "deny":
      return "Denegar";
    default:
      return "Heredar";
  }
}

export function formatLimitRecord(
  limit: RoleLimitRecord | undefined,
): string {
  if (!limit || !Number.isFinite(limit.limit) || limit.limit <= 0) {
    return "Sin limite configurado";
  }

  const count = Math.max(0, Math.floor(limit.limit));
  const description =
    (limit.window ? WINDOW_DESCRIPTIONS[limit.window] : null) ??
    (limit.windowSeconds ? `cada ${limit.windowSeconds}s` : "sin ventana fija");

  return `${count} uso(s) - ${description}`;
}

export function buildModerationSummary(
  snapshot: ManagedRoleSnapshot,
): string {
  return DEFAULT_MODERATION_ACTIONS.map((action) => {
    const override = snapshot.overrides[action.key] ?? "inherit";
    const limit = snapshot.limits[action.key];
    return `- **${action.label}** -> ${formatOverrideValue(override)} - ${formatLimitRecord(limit)}`;
  }).join("\n");
}
