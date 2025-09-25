import type { GuildCommandContext } from "seyfert";
import { Embed, createMiddleware } from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
import { consumeRoleRateLimits, type RateLimitViolation } from "@/modules/guild-roles";

/**
 * Middleware global que valida y consume los limites configurados para roles administrados.
 * Usa el nombre completo del comando como clave unica para registrar los consumos.
 */
async function collectRoleIds(context: GuildCommandContext): Promise<Set<string>> {
  const member = context.member;
  if (!member) return new Set();

  const roles = await member.roles.list();


  const ids = new Set<string>();
  if (!roles) return ids;

  const push = (value: unknown) => {
    if (typeof value === "string" && value) {
      ids.add(value);
      return;
    }

    if (value && typeof value === "object") {
      const candidate = (value as { id?: unknown; roleId?: unknown }).id
        ?? (value as { id?: unknown; roleId?: unknown }).roleId;
      if (typeof candidate === "string" && candidate) {
        ids.add(candidate);
      }
    }
  };

  const iterate = (iterable: Iterable<unknown>) => {
    for (const entry of iterable) push(entry);
  };

  if (Array.isArray(roles)) {
    iterate(roles);
    return ids;
  }

  if (typeof roles === "object" && roles) {
    const cacheValues = (roles as { cache?: { values?: () => Iterable<unknown> } }).cache?.values;
    if (typeof cacheValues === "function") {
      iterate(cacheValues.call((roles as { cache: { values: () => Iterable<unknown> } }).cache));
      return ids;
    }

    const values = (roles as { values?: () => Iterable<unknown> }).values;
    if (typeof values === "function") {
      iterate(values.call(roles));
      return ids;
    }

    if (Symbol.iterator in (roles as object)) {
      iterate(roles as Iterable<unknown>);
    }
  }

  return ids;
}

/** Convierte segundos en texto legible para informar ventanas de tiempo. */
function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const secs = total % 60;

  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!parts.length || secs) parts.push(`${secs}s`);
  return parts.join(" ");
}

/** Construye la respuesta que se envia cuando el limite ya se consumio. */
function buildLimitEmbed(actionKey: string, violation: RateLimitViolation): Embed {
  const retrySeconds = Math.max(1, Math.ceil((violation.resetAt - Date.now()) / 1_000));
  const windowText = formatSeconds(violation.limit.perSeconds);

  return new Embed({
    title: "Limite alcanzado",
    color: EmbedColors.Red,
    description: [
      `El rol configurado \`${violation.roleKey}\` ya supero el cupo para **${actionKey}**.`,
      `Limite vigente: ${violation.limit.uses} usos cada ${windowText}.`,
      `Podras intentarlo nuevamente en ${formatSeconds(retrySeconds)}.`,
    ].join("\n"),
  });
}

/** Middleware global: aplica los limites de roles antes de ejecutar comandos. */
export const rateLimit = createMiddleware<void>(async (middle) => {
  const context = middle.context as GuildCommandContext;

  if (!context.inGuild()) {
    return middle.next();
  }

  const actionKey = context.fullCommandName?.toLowerCase().trim();
  if (!actionKey) {
    return middle.next();
  }

  // console.debug(`[rate-limit] comando=${actionKey}`);

  const roleIds = await collectRoleIds(context);
  if (!roleIds.size) {
    return middle.next();
  }

  const guildId = context.guildId;
  if (!guildId) {
    return middle.next();
  }

  const result = await consumeRoleRateLimits({
    guildId,
    actionKey,
    memberRoleIds: [...roleIds],
    database: context.db.instance,
  });

  console.debug("[rate-limit] resultado", result);

  if (result.allowed) {
    return middle.next();
  }

  const embed = buildLimitEmbed(actionKey, result.violation);

  await context.write({ embeds: [embed] });

  return middle.stop("rate-limit-blocked");
});
