import type { GuildCommandContext } from "seyfert";
import {
  Declare,
  Embed,
  Options,
  SubCommand,
  createStringOption,
} from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
import { removeManagedChannel } from "@/modules/guild-channels";
import { requireGuildId } from "@/utils/commandGuards";

const options = {
  id: createStringOption({
    description: "Identificador del canal opcional",
    required: true,
  }),
};

// Elimina un canal opcional previamente registrado.
@Declare({
  name: "remove",
  description: "Eliminar un canal opcional",
})
@Options(options)
export default class ChannelRemoveCommand extends SubCommand {
  async run(ctx: GuildCommandContext<typeof options>) {
    const guildId = await requireGuildId(ctx);
    if (!guildId) return;

    const identifier = ctx.options.id.trim();
    if (!identifier) {
      await ctx.write({ content: "[!] Debes indicar un identificador valido." });
      return;
    }

    const removed = await removeManagedChannel(guildId, identifier);

    if (!removed) {
      await ctx.write({ content: "[!] No se encontro un canal con ese identificador." });
      return;
    }

    const embed = new Embed({
      title: "Canal opcional eliminado",
      description: `Se elimino la referencia **${identifier}**`,
      color: EmbedColors.Red,
    });

    await ctx.write({ embeds: [embed] });
  }
}

