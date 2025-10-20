import type { GuildCommandContext } from "seyfert";
import { Declare, Embed, SubCommand } from "seyfert";
import { EmbedColors } from "seyfert/lib/common";

import {
  buildModerationSummary,
  fetchManagedRoles,
  requireGuildContext,
} from "./shared";

// Muestra el estado actual de los roles administrados y sus limites.
@Declare({
  name: "list",
  description: "Listar roles administrados y sus limites",
})
export default class RoleListCommand extends SubCommand {
  async run(ctx: GuildCommandContext) {
    const context = await requireGuildContext(ctx);
    if (!context) return;

    const roles = await fetchManagedRoles(context.guildId);

    if (!roles.length) {
      const empty = new Embed({
        title: "Roles administrados",
        description: "No hay configuraciones registradas.",
        color: EmbedColors.Greyple,
      });
      await ctx.write({ embeds: [empty] });
      return;
    }

    const fields = roles.map((snapshot) => {
      const value = [
        snapshot.discordRoleId
          ? `Rol vinculado: <@&${snapshot.discordRoleId}>`
          : "Rol vinculado: Sin asignar",
        "",
        buildModerationSummary(snapshot),
      ].join("\n");

      return {
        name: `${snapshot.key} - ${snapshot.label}`,
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

