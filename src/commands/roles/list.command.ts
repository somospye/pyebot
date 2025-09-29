import type { GuildCommandContext } from "seyfert";
import { Declare, Embed, SubCommand } from "seyfert";
import { EmbedColors } from "seyfert/lib/common";

import { describeWindow, listRoles } from "@/modules/guild-roles";

// Muestra el estado actual de los roles administrados y sus limites.
@Declare({
  name: "list",
  description: "Listar roles administrados y sus limites",
})
export default class RoleListCommand extends SubCommand {
  async run(ctx: GuildCommandContext) {
    const roles = await listRoles(ctx.guildId, ctx.db.instance);

    if (roles.length === 0) {
      const empty = new Embed({
        title: "Roles administrados",
        description: "No hay configuraciones registradas.",
        color: EmbedColors.Greyple,
      });
      await ctx.write({ embeds: [empty] });
      return;
    }

    const fields = roles.map(({ roleKey, record }) => {
      const limits = Object.entries(record.limits ?? {});
      const limitText = limits.length
        ? limits
            .map(([action, limit]) => {
              if (!limit || !limit.limit || limit.limit <= 0) {
                return `- **${action}** -> deshabilitado`;
              }
              return `- **${action}** -> ${limit.limit} usos cada ${describeWindow(limit)}`;
            })
            .join("\n")
        : "Sin limites configurados";

      const overrides = Object.entries(record.reach ?? {});
      const overrideText = overrides.length
        ? overrides
            .map(([action, override]) => `- **${action}** -> ${override}`)
            .join("\n")
        : "Todos heredan permisos de Discord";

      const value = [
        record.discordRoleId
          ? `Rol vinculado: <@&${record.discordRoleId}>`
          : "Rol vinculado: Sin asignar",
        "",
        "**Overrides**",
        overrideText,
        "",
        "**Limites**",
        limitText,
      ].join("\n");

      return {
        name: `${roleKey} · ${record.label}`,
        value,
      };
    });

    const embed = new Embed({
      title: "Roles administrados",
      color: EmbedColors.Blurple,
      fields,
    });

    await ctx.write({ embeds: [embed] });
  }
}
