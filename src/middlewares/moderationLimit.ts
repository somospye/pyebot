import type { GuildCommandContext } from "seyfert";
import { Embed, createMiddleware } from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
import {
  consumeRoleLimits,
  resolveRoleActionPermission,
  type RoleLimitBlock,
  type ResolveRoleActionPermissionResult,
} from "@/modules/guild-roles";

async function collectRoleIds(
  context: GuildCommandContext,
): Promise<Set<string>> {
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
      const candidate =
        (value as { id?: unknown; roleId?: unknown }).id ??
        (value as { id?: unknown; roleId?: unknown }).roleId;
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
    const cacheValues = (
      roles as { cache?: { values?: () => Iterable<unknown> } }
    ).cache?.values;
    if (typeof cacheValues === "function") {
      iterate(
        cacheValues.call(
          (roles as { cache: { values: () => Iterable<unknown> } }).cache,
        ),
      );
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

function buildOverrideDeniedEmbed(
  actionKey: string,
  decision: ResolveRoleActionPermissionResult,
): Embed {
  const lines: string[] = [
    `La accion **${actionKey}** esta denegada por la configuracion del bot.`,
  ];

  if (decision.roleKey) {
    lines.push(
      `Override aplicado por la clave de rol \`${decision.roleKey}\`.`,
    );
  }

  return new Embed({
    title: "Accion bloqueada",
    color: EmbedColors.Red,
    description: lines.join("\n"),
  });
}

function buildBlockEmbed(actionKey: string, block: RoleLimitBlock): Embed {
  const retrySeconds = Math.max(
    1,
    Math.ceil((block.resetAt - Date.now()) / 1_000),
  );
  const windowText = formatSeconds(block.windowSeconds);

  return new Embed({
    title: "Limite alcanzado",
    color: EmbedColors.Red,
    description: [
      `El rol configurado \`${block.roleKey}\` ya supero el cupo para **${actionKey}**.`,
      `Limite vigente: ${block.limit.limit} usos cada ${windowText}.`,
      `Podras intentarlo nuevamente en ${formatSeconds(retrySeconds)}.`,
    ].join("\n"),
  });
}

export const moderationLimit = createMiddleware<void>(async (middle) => {
  const context = middle.context as GuildCommandContext;

  if (!context.inGuild()) {
    return middle.next();
  }

  const actionKey = context.fullCommandName?.toLowerCase().trim();
  if (!actionKey) {
    return middle.next();
  }

  const roleIds = await collectRoleIds(context);
  if (!roleIds.size) {
    return middle.next();
  }

  const guildId = context.guildId;
  if (!guildId) {
    return middle.next();
  }

  const overrideDecision = await resolveRoleActionPermission({
    guildId,
    actionKey,
    memberRoleIds: [...roleIds],
    hasDiscordPermission: true,
    database: context.db.instance,
  });

  if (!overrideDecision.allowed) {
    const embed = buildOverrideDeniedEmbed(actionKey, overrideDecision);
    await context.write({ embeds: [embed] });
    return middle.stop("moderation-override-blocked");
  }

  const result = await consumeRoleLimits({
    guildId,
    actionKey,
    memberRoleIds: [...roleIds],
    database: context.db.instance,
  });

  console.debug("[moderation-limit] resultado", result);

  if (result.allowed) {
    return middle.next();
  }

  const embed = buildBlockEmbed(actionKey, result.violation);

  await context.write({ embeds: [embed] });

  return middle.stop("moderation-limit-blocked");
});
