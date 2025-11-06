import type { GuildCommandContext } from "seyfert";
import {
  createStringOption,
  Declare,
  Embed,
  Options,
  SubCommand,
} from "seyfert";
import { EmbedColors } from "seyfert/lib/common";

import * as repo from "@/modules/repo";
import { requireGuildContext } from "./shared";

const options = {
  key: createStringOption({
    description: "Clave del rol administrado a eliminar",
    required: true,
  }),
};

@Declare({
  name: "remove",
  description: "Eliminar un rol administrado",
})
@Options(options)
export default class RoleRemoveCommand extends SubCommand {
  async run(ctx: GuildCommandContext<typeof options>) {
    const context = await requireGuildContext(ctx);
    if (!context) return;

    const key = ctx.options.key.trim();
    if (!key) {
      const embed = new Embed({
        title: "Clave invalida",
        description: "Proporciona una clave conocida para eliminar la configuracion.",
        color: EmbedColors.Red,
      });
      await ctx.write({ embeds: [embed] });
      return;
    }

    const removed = await repo.removeRole(context.guildId, key);

    const embed = new Embed({
      title: removed ? "Rol eliminado" : "Rol no encontrado",
      description: removed
        ? `Se elimino la configuracion **${key}**.`
        : "No existia una configuracion con esa clave.",
      color: removed ? EmbedColors.Red : EmbedColors.Orange,
    });

    await ctx.write({ embeds: [embed] });
  }
}
