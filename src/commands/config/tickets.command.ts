import {
  createChannelOption,
  Declare,
  type GuildCommandContext,
  Options,
  SubCommand,
} from "seyfert";
import { ChannelType } from "seyfert/lib/types";
import { get_data_api, toChannelId, toGuildId } from "@/modules/flat_api";

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

    if (!ctx.guildId) {
      await ctx.write({
        content: "Este comando solo puede ejecutarse dentro de un servidor.",
      });
      return;
    }

    const guildId = toGuildId(ctx.guildId);
    const store = get_data_api();
    await store.ensureGuild(guildId);

    await store.setGuildCoreChannel(guildId, "tickets", toChannelId(channel.id));
    await store.setGuildCoreChannel(
      guildId,
      "ticketLogs",
      toChannelId(logChannel.id)
    );

    await store.setGuildTicketCategory(guildId, toChannelId(category.id));

    await ctx.write({
      content: "Configuración de tickets guardada correctamente.",
    });
  }
}




