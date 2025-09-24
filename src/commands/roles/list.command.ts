import type { GuildCommandContext } from "seyfert";
import { Declare, Embed, SubCommand } from "seyfert";
import { EmbedColors } from "seyfert/lib/common";

import { listRoles } from "@/modules/guild-roles";

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

    const fields = roles.map(({ id, record }) => {
      const limits = Object.entries(record.rateLimits);
      const value = limits.length
        ? limits
          .map(([action, limit]) =>
            limit
              ? `- **${action}** -> ${limit.uses} usos cada ${limit.perSeconds}s`
              : `- **${action}** -> sin limite`,
          )
          .join("\n")
        : "Sin limites configurados";

      return {
        name: id,
        value: `${value}\nRol vinculado: <@&${record.roleId}>`,
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
