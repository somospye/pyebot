import type { GuildCommandContext } from "seyfert";
import {
  Declare,
  Embed,
  Options,
  SubCommand,
  createChannelOption,
  createStringOption,
} from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
import {
  CORE_CHANNEL_DEFINITIONS,
  CORE_CHANNEL_LABELS,
  type CoreChannelName,
  setCoreChannel,
} from "@/modules/guild-channels";

const nameChoices = CORE_CHANNEL_DEFINITIONS.map((definition) => ({
  name: `${definition.name} (${definition.label})`,
  value: definition.name,
}));

const options = {
  name: createStringOption({
    description: "Nombre del canal requerido",
    required: true,
    choices: nameChoices,
  }),
  channel: createChannelOption({
    description: "Canal de Discord a asociar",
    required: true,
  }),
};

// Actualiza la referencia de un canal core obligatorio.
@Declare({
  name: "set",
  description: "Actualizar uno de los canales requeridos",
})
@Options(options)
export default class ChannelSetCommand extends SubCommand {
  async run(ctx: GuildCommandContext<typeof options>) {
    const guildId = ctx.guildId;
    if (!guildId) {
      throw new Error("Guild ID is required to actualizar un canal requerido");
    }

    const name = ctx.options.name as CoreChannelName;
    const channelId = String(ctx.options.channel.id);

    const record = await setCoreChannel(
      guildId,
      name,
      channelId,
      ctx.db.instance,
    );

    const embed = new Embed({
      title: "Canal actualizado",
      description: `Se asigno <#${record.channelId}> a **${name}** (${CORE_CHANNEL_LABELS[name]})`,
      color: EmbedColors.Green,
    });

    await ctx.write({ embeds: [embed] });
  }
}

