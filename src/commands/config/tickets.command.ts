import {
  createChannelOption,
  Declare,
  type GuildCommandContext,
  Options,
  SubCommand,
} from "seyfert";
import { ChannelType } from "seyfert/lib/types";
import { getDB, type ChannelId } from "@/modules/repo";
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

    await store.setGuildCoreChannel(
      guildId,
      "ticketCategory",
      category.id as ChannelId,
    );

    // Debug, traer los datos mandados a la base de datos para comprobar que se guardaron bien
    const ticketChannel = await store.getGuildCoreChannel(guildId, "tickets");
    const ticketLogs = await store.getGuildCoreChannel(guildId, "ticketLogs");
    const ticketCategory = await store.getGuildCoreChannel(guildId, "ticketCategory");

    console.log("Datos guardados en la base de datos:");
    console.log("Canal de tickets:", ticketChannel);
    console.log("Canal de logs de tickets:", ticketLogs);
    console.log("Categoría de tickets:", ticketCategory);

    await ctx.write({
      content: "Configuración de tickets guardada correctamente.",
    });
  }
}




