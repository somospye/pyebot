import type { GuildCommandContext } from "seyfert";
import { Embed, createMiddleware } from "seyfert";
import { EmbedColors } from "seyfert/lib/common";

import {
  consumeRoleRateLimits,
  type RateLimitViolation,
} from "@/modules/guild-roles";

/**
 * Middleware global que valida y consume los limites configurados para roles
 * administrados. Si el usuario supera el cupo permitido, detiene el comando y
 * muestra un mensaje al moderador.
 */

/** Describe la accion asociada a un comando monitoreado. */
interface ActionDescriptor {
  actionKey: string;
  label: string;
}

const ACTION_MAP: Record<string, ActionDescriptor> = {
  kick: { actionKey: "kick", label: "kick" },
  ban: { actionKey: "ban", label: "ban" },
  "warn add": { actionKey: "warn.add", label: "warn add" },
};

/** Determina la accion monitoreada basada en el nombre completo del comando. */
function resolveAction(context: GuildCommandContext): ActionDescriptor | null {
  const name = context.fullCommandName?.toLowerCase().trim();
  if (!name) return null;
  return ACTION_MAP[name] ?? null;
}

/**
 * Normaliza la estructura de roles del miembro y devuelve IDs unicos.
 */
function extractRoleIds(context: GuildCommandContext): string[] {
  const member = context.member as { roles?: unknown } | undefined;
  const roles = member?.roles;
  if (!roles) return [];

  const collect = (items: Iterable<unknown>): string[] => {
    const buffer: string[] = [];
    for (const value of items) {
      if (typeof value === "string") {
        buffer.push(value);
        continue;
      }
      if (value && typeof value === "object") {
        const id = (value as { id?: string; roleId?: string }).id ?? (value as { id?: string; roleId?: string }).roleId;
        if (id) buffer.push(id);
      }
    }
    return buffer;
  };

  if (Array.isArray(roles)) {
    return collect(roles);
  }

  if (typeof roles === "object") {
    if (
      (roles as { cache?: { values?: () => Iterable<unknown> } }).cache &&
      typeof (roles as { cache: { values?: () => Iterable<unknown> } }).cache.values === "function"
    ) {
      return collect((roles as { cache: { values: () => Iterable<unknown> } }).cache.values());
    }
    if (typeof (roles as { values?: () => Iterable<unknown> }).values === "function") {
      return collect((roles as { values: () => Iterable<unknown> }).values());
    }
    if (Symbol.iterator in (roles as object)) {
      return collect(roles as Iterable<unknown>);
    }
  }

  return [];
}

/** Convierte una cantidad de segundos en formato legible para embeds. */
function formatSeconds(seconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const units: Array<{ label: string; value: number }> = [
    { label: "h", value: 3600 },
    { label: "m", value: 60 },
  ];

  let remaining = safeSeconds;
  const parts: string[] = [];

  for (const unit of units) {
    if (remaining >= unit.value) {
      const amount = Math.floor(remaining / unit.value);
      remaining %= unit.value;
      parts.push(`${amount}${unit.label}`);
    }
  }

  if (!parts.length || remaining > 0) {
    parts.push(`${remaining}s`);
  }

  return parts.join(" ");
}

/** Construye la respuesta informando que el limite fue alcanzado. */
function buildLimitEmbed(action: ActionDescriptor, violation: RateLimitViolation): Embed {
  const retryIn = Math.max(1, Math.ceil((violation.resetAt - Date.now()) / 1000));
  const windowText = formatSeconds(violation.limit.perSeconds);

  return new Embed({
    title: "Limite de rol alcanzado",
    color: EmbedColors.Red,
    description: [
      `El rol configurado \`${violation.roleKey}\` ya alcanzo el cupo para **${action.label}**.`,
      `Limite definido: ${violation.limit.uses} usos cada ${windowText}.`,
      `Puedes intentarlo nuevamente en ${formatSeconds(retryIn)}.`,
    ].join("\n"),
  });
}

/**
 * Middleware principal: valida limites, registra trazas y detiene el comando
 * cuando el cupo fue consumido.
 */
export const rateLimit = createMiddleware<void>(async (middle) => {
  const context = middle.context as GuildCommandContext;

  if (!context.inGuild() || !context.guildId) {
    console.debug("[rate-limit] comando fuera de guild, omitiendo");
    return middle.next();
  }

  const action = resolveAction(context);
  if (!action) {
    console.debug(`[rate-limit] comando ${context.fullCommandName} no monitoreado, omitiendo`);
    return middle.next();
  }


  const roleIds = Array.from(new Set(extractRoleIds(context)));
  if (!roleIds.length) {
    console.debug("[rate-limit] usuario sin roles, omitiendo");
    return middle.next();
  }

  
  const guildId = context.guildId;

  const result = await consumeRoleRateLimits({
    guildId,
    actionKey: action.actionKey,
    memberRoleIds: roleIds,
    database: context.db.instance,
  });


  if (result.allowed) {
    return middle.next();
  }

  const embed = buildLimitEmbed(action, result.violation);
  await context.write({ embeds: [embed] });

  return middle.stop("rate-limit-blocked");
});
