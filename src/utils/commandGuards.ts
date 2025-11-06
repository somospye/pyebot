
import type { InteractionGuildMember } from "seyfert";
import { resolveRoleActionPermission } from "@/modules/guild-roles";

const DEFAULT_GUILD_ONLY_MESSAGE =
  "[!] Este comando solo puede ejecutarse dentro de un servidor.";
const DEFAULT_PERMISSION_DENIED_MESSAGE =
  "[!] No tienes permisos suficientes para ejecutar este comando.";
const DEFAULT_OVERRIDE_DENIED_MESSAGE =
  "[!] Un override configurado en el bot bloquea este comando.";

type GuildAwareContext = {
  guildId?: string | null;
  write(payload: { content: string }): Promise<unknown>;
};

type PermissionInput = string | readonly string[] | string[];

const ensureArray = (value?: PermissionInput | null): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry): entry is string => Boolean(entry));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
};

/**
 * Collect role identifiers for a guild interaction member.
 * Handles both REST/Cached responses transparently.
 */
export async function collectMemberRoleIds(
  member: InteractionGuildMember | null | undefined,
): Promise<Set<string>> {
  const ids = new Set<string>();

  if (!member) return ids;

  try {
    const roles = await member.roles.list();

    const push = (value: unknown) => {
      if (typeof value === "string" && value) {
        ids.add(value);
        return;
      }

      if (!value || typeof value !== "object") return;

      const candidate =
        (value as { id?: unknown }).id ??
        (value as { roleId?: unknown }).roleId ??
        (value as { role_id?: unknown }).role_id;

      if (typeof candidate === "string" && candidate) {
        ids.add(candidate);
      }
    };

    const iterate = (iterable: Iterable<unknown>) => {
      for (const entry of iterable) push(entry);
    };

    if (Array.isArray(roles)) {
      iterate(roles);
      return ids;
    }

    if (roles && typeof roles === "object") {
      const cacheValues = (roles as { cache?: { values?: () => Iterable<unknown> } })
        .cache?.values;
      if (typeof cacheValues === "function") {
        iterate(cacheValues.call(
          (roles as { cache: { values: () => Iterable<unknown> } }).cache,
        ));
        return ids;
      }

      const values = (roles as { values?: () => Iterable<unknown> }).values;
      if (typeof values === "function") {
        iterate(values.call(roles));
        return ids;
      }

      if (Symbol.iterator in roles) {
        iterate(roles as Iterable<unknown>);
        return ids;
      }
    }
  } catch (error) {
    console.warn("[commandGuards] No se pudieron obtener los roles del miembro", error);
  }

  return ids;
}

async function memberHasDiscordPermission(
  member: InteractionGuildMember | null | undefined,
  required: string[],
): Promise<boolean> {
  if (!required.length) return true;
  if (!member) return false;

  const permissions = member.permissions;
  if (permissions && typeof permissions.has === "function") {
    return permissions.has(required as any);
  }

  if (typeof member.fetchPermissions === "function") {
    try {
      const fetched = await member.fetchPermissions();
      if (fetched && typeof fetched.has === "function") {
        return fetched.has(required as any);
      }
    } catch (error) {
      console.warn(
        "[commandGuards] No se pudieron obtener los permisos del miembro",
        error,
      );
    }
  }

  return false;
}

/**
 * Ensure the current command context runs inside a guild.
 * Sends a standard warning message when invoked from DMs.
 *
 * @param ctx Command or component context with a `guildId`.
 * @param message Override for the warning text.
 * @returns Resolved guild identifier or null when unavailable.
 */
export async function requireGuildId<T extends GuildAwareContext>(
  ctx: T,
  message = DEFAULT_GUILD_ONLY_MESSAGE,
): Promise<string | null> {
  if (!ctx) return null;
  if (!ctx.guildId) {
    await ctx.write({ content: message });
    return null;
  }
  return ctx.guildId;
}

export interface RequireGuildPermissionOptions {
  guildId: string;
  permissions?: PermissionInput;
  actionKey?: string;
  overrideDeniedMessage?: string;
  missingPermissionMessage?: string;
}

/**
 * Validates whether the invoking member can run the command either by
 * Discord permissions or by an explicit override stored in guild-roles.
 */
export async function requireGuildPermission<T extends GuildAwareContext & {
  member?: InteractionGuildMember | null;
  fullCommandName?: string | null;
}>(
  ctx: T,
  {
    guildId,
    permissions,
    actionKey,
    overrideDeniedMessage = DEFAULT_OVERRIDE_DENIED_MESSAGE,
    missingPermissionMessage = DEFAULT_PERMISSION_DENIED_MESSAGE,
  }: RequireGuildPermissionOptions,
): Promise<boolean> {
  const requiredPermissions = ensureArray(permissions);

  const memberRoleIds = await collectMemberRoleIds(ctx.member ?? null);
  const hasDiscordPermission = await memberHasDiscordPermission(
    ctx.member ?? null,
    requiredPermissions,
  );

  const fallbackNames = ctx as {
    commandName?: string | null;
    name?: string | null;
  };

  const rawAction =
    actionKey ??
    ctx.fullCommandName ??
    fallbackNames.commandName ??
    fallbackNames.name ??
    "";
  const normalisedAction = rawAction?.toString().trim().toLowerCase();

  if (!normalisedAction) {
    console.warn(
      "[commandGuards] No se pudo resolver la accion para validar permisos.",
    );
    await ctx.write({ content: missingPermissionMessage });
    return false;
  }

  const decision = await resolveRoleActionPermission({
    guildId,
    actionKey: normalisedAction,
    memberRoleIds: [...memberRoleIds],
    hasDiscordPermission,
  });

  if (decision.allowed) {
    return true;
  }

  const message =
    decision.decision === "override-deny"
      ? overrideDeniedMessage
      : missingPermissionMessage;

  await ctx.write({ content: message });
  return false;
}

export const GUILD_ONLY_MESSAGE = DEFAULT_GUILD_ONLY_MESSAGE;
