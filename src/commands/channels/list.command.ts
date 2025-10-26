import type { GuildCommandContext } from "seyfert";
import { Declare, Embed, SubCommand } from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
import {
  CORE_CHANNEL_DEFINITIONS,
  getGuildChannels,
} from "@/modules/guild-channels";
import { requireGuildId, requireGuildPermission } from "@/utils/commandGuards";

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

    const allowed = await requireGuildPermission(ctx, {
      guildId,
      permissions: ["ManageChannels"],
    });
    if (!allowed) return;

    const guild_channels_record = await getGuildChannels(guildId);

    const coreLines = CORE_CHANNEL_DEFINITIONS.map((definition) => {
      const entry = guild_channels_record.core[definition.name];
      if(!entry) {
        return `**${definition.name}** (${definition.label}) -> Sin canal`;
      }

      return `**${definition.name}** (${definition.label}) -> ${formatChannelMention(entry.channelId)}`;
    }).join("\n\n");

    const managedEntries = Object.values(guild_channels_record.managed);
    const managedLines = managedEntries.length
      ? managedEntries
        .map((entry) => `**${entry.id}** (${entry.label}) -> ${formatChannelMention(entry.channelId)}`)
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

