import type { GuildCommandContext } from "seyfert";
import { Declare, Embed, SubCommand } from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
import {
  CORE_CHANNEL_DEFINITIONS,
  getGuildChannels,
} from "@/modules/guild-channels";
import { requireGuildId } from "@/utils/commandGuards";

function formatChannelMention(channelId: string): string {
  return channelId ? `<#${channelId}>` : "Sin canal";
}

// Lista los canales core y opcionales actualmente vinculados.
@Declare({
  name: "list",
  description: "Mostrar el estado de los canales configurados",
})
export default class ChannelListCommand extends SubCommand {
  async run(ctx: GuildCommandContext) {
    const guildId = await requireGuildId(ctx);
    if (!guildId) return;

    const snapshot = await getGuildChannels(guildId);

    const coreLines = CORE_CHANNEL_DEFINITIONS.map((definition) => {
      const entry = snapshot.core[definition.name];
      return `\u0007 **${definition.name}** (${definition.label}) \u001a ${formatChannelMention(entry.channelId)}`;
    }).join("\n\n");

    const managedEntries = Object.values(snapshot.managed);
    const managedLines = managedEntries.length
      ? managedEntries
        .map((entry) => `\u0007 **${entry.id}** (${entry.label}) \u001a ${formatChannelMention(entry.channelId)}`)
        .join("\n")
      : "Sin canales opcionales configurados.";

    const embed = new Embed({
      title: "Configuracion de canales",
      color: EmbedColors.Blurple,
      fields: [
        {
          name: "Canales requeridos",
          value: coreLines,
        },
        {
          name: "Canales opcionales",
          value: managedLines,
        },
      ],
    });

    await ctx.write({ embeds: [embed] });
  }
}

