import type { GuildCommandContext } from "seyfert";
import { Declare, Embed, SubCommand } from "seyfert";
import { EmbedColors } from "seyfert/lib/common";

import { createSession, renderSession } from "@/ui/dashboard/state";
import { getGuildRoles } from "@/modules/guild-roles";

const ENV_ALLOWED_ROLES = new Set(
  (process.env.ROLES_DASHBOARD_ALLOWED_ROLES ?? "")
    .split(/[,\s]+/)
    .map((id) => id.trim())
    .filter(Boolean),
);

@Declare({
  name: "dashboard",
  description: "Abrir el panel interactivo de roles",
})
export default class RolesDashboardCommand extends SubCommand {
  async run(ctx: GuildCommandContext): Promise<void> {
    if (!ctx.inGuild() || !ctx.guildId) {
      const embed = new Embed({
        title: "Solo en servidores",
        description: "Este panel solo puede usarse dentro de un servidor.",
        color: EmbedColors.Red,
      });
      await ctx.write({ embeds: [embed], flags: 1 << 6 });
      return;
    }

    if (!(await isAuthorized(ctx))) {
      const embed = new Embed({
        title: "Sin permisos",
        description: "No tienes permisos para administrar este panel.",
        color: EmbedColors.Red,
      });
      await ctx.write({ embeds: [embed], flags: 1 << 6 });
      return;
    }

    const roles = await getGuildRoles(ctx.guildId, ctx.db.instance);
    const session = createSession({
      guildId: ctx.guildId,
      moderatorId: ctx.author.id,
      roles,
    });

    const view = renderSession(session);

    await ctx.deferReply(true);
    await ctx.editResponse({
      content: view.content,
      embeds: view.embeds,
      components: view.components,
    });

    session.applicationId = ctx.client.applicationId;
    session.responseToken = ctx.interaction.token;
    const original = await ctx.fetchResponse().catch(() => null);
    session.messageId = original?.id ?? null;
  }
}

export async function isAuthorized(ctx: GuildCommandContext): Promise<boolean> {
  const manageGuild = Boolean(
    (ctx.member?.permissions as { has?: (perm: unknown) => boolean } | undefined)?.has?.([
      "ManageGuild",
    ]),
  );

  if (ENV_ALLOWED_ROLES.size === 0) {
    return Boolean(manageGuild);
  }

  const roleIds = await collectRoleIds(ctx);
  for (const roleId of roleIds) {
    if (ENV_ALLOWED_ROLES.has(roleId)) {
      return true;
    }
  }

  return Boolean(manageGuild);
}

export async function collectRoleIds(
  context: GuildCommandContext,
): Promise<Set<string>> {
  const member = context.member;
  const ids = new Set<string>();
  if (!member) return ids;

  try {
    const roles = await member.roles.list();
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
  } catch {
    // ignore failures, fall back to permission check
  }

  return ids;
}
