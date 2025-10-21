import {
  createChannelOption,
  Declare,
  type GuildCommandContext,
  Options,
  SubCommand,
} from "seyfert";
import { ChannelType } from "seyfert/lib/types";
import { getDB, type ChannelId, type GuildId } from "@/modules/flat_api";
import { requireGuildId } from "@/utils/commandGuards";

const options = {
  // Canal de tickets
  channel: createChannelOption({
    description: "Canal donde se enviara el mensaje de tickets",
    required: true,
    channel_types: [ChannelType.GuildText],
  }),

  // Cateroria donde se crearan los tickets
  category: createChannelOption({
    description: "Categoría donde se crearán los tickets",
    required: true,
    channel_types: [ChannelType.GuildCategory],
  }),

  // Canal de logs de tickets
  logChannel: createChannelOption({
    description: "Canal donde se enviaran los logs de los tickets",
    required: true,
    channel_types: [ChannelType.GuildText],
  }),
};

@Declare({
  name: "tickets",
  description: "Configurar el sistema de tickets",
  defaultMemberPermissions: ["ManageChannels"],
})
@Options(options)
export default class ConfigTicketsCommand extends SubCommand {
  async run(ctx: GuildCommandContext<typeof options>) {
    const { channel, category, logChannel } = ctx.options;

    const guildId = await requireGuildId(ctx);
    if (!guildId) return;

    const store = getDB();
    await store.ensureGuild(guildId);

    await store.setGuildCoreChannel(
      guildId,
      "tickets",
      channel.id as ChannelId,
    );
    await store.setGuildCoreChannel(
      guildId,
      "ticketLogs",
      logChannel.id as ChannelId,
    );

    await store.setGuildTicketCategory(guildId, category.id as ChannelId);

    await ctx.write({
      content: "Configuración de tickets guardada correctamente.",
    });
  }
}




