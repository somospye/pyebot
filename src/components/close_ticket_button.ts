import { getGuildChannels } from "@/modules/guild-channels";
import { Colors } from "@/modules/ui/colors";
import { TICKET_CLOSE_BUTTON_ID } from "@/systems/tickets";
import { create_transcription } from "@/systems/tickets/transcription";
import { AttachmentBuilder, ComponentCommand, Embed, TextGuildChannel, type ComponentContext } from "seyfert";

// * Boton de cerrar ticket
// Cuando se presiona el boton de cerrar ticket, se cierra el canal del ticket actual
export default class CloseTicketButton extends ComponentCommand {
    componentType = "Button" as const;

    filter(ctx: ComponentContext<"Button">) {
        return ctx.customId.startsWith(TICKET_CLOSE_BUTTON_ID);
    }

    async run(ctx: ComponentContext<"Button">) {
        // Defer the update to avoid "This interaction failed" message
        // await ctx.deferUpdate();

        // Ticket ID should have format tickets:close:{ChannelId}
        const ticketChannelId = ctx.customId.split(":")[2];

        const ticketChannel = (await ctx.client.channels.fetch(ticketChannelId)) as TextGuildChannel;

        // Send the transcript to the ticket logs channel
        const guildId = ctx.guildId as string;

        const ticketLogsChannelId = (await getGuildChannels(guildId)).core?.ticketLogs?.channelId;

        let closing_embed = new Embed()
            .setColor(Colors.info)
            .setTitle("Cerrando Ticket")
            .setDescription("El ticket se cerrará en breve...")
            .setFooter({text: `Cerrado por ${ctx.author?.username || "???"}`});


        await ctx.editOrReply({
            embeds: [closing_embed],
        });

        // If log channel exists, create and send the transcript
        if (ticketLogsChannelId) {
            // Create transcript and close the ticket channel
            const transcriptBuffer = await create_transcription(ctx.client, ticketChannelId);
            const transcripción_attachment = new AttachmentBuilder()
                .setName("transcript.html")
                .setDescription("Transcripción del ticket")
                .setFile('buffer', transcriptBuffer)

            // Send the transcript to the ticket logs channel
            try {
                const logChannel = await ctx.client.channels.fetch(ticketLogsChannelId)
                
                if (logChannel?.isTextGuild()) {
                    await logChannel.messages.write({
                        content: `Transcripción del ticket: ${ticketChannel.name}`,
                        files: [transcripción_attachment],
                    });

                    closing_embed.setDescription(
                        closing_embed.data.description +
                        `\nLa transcripción ha sido enviada a <#${ticketLogsChannelId}>.`);
                        
                    await ctx.editOrReply({
                        embeds: [closing_embed],
                    });
                }

                else {
                    ctx.client.logger?.error?.("[tickets] ticket logs channel is not a text channel", {
                        guildId,
                        ticketLogsChannelId,
                    });
                }
            } catch (error) {
                ctx.client.logger?.error?.("[tickets] failed to fetch ticket logs channel", {
                    error,
                    ticketLogsChannelId,
                });
            }
        }

        // If no ticket logs channel is configured, skip sending the transcript
        if (!ticketLogsChannelId) {
            closing_embed.setDescription(
                closing_embed.data.description +
                "\nNo hay un canal de logs de tickets configurado. El ticket se cerrará sin guardar la transcripción.");
            await ctx.editOrReply({
                embeds: [closing_embed],
            });
        }

        await new Promise((resolve) => setTimeout(resolve, 10000));

        await ctx.client.channels.delete(ticketChannelId);

        // After closing the ticket, you can log action
        ctx.client.logger?.info?.("[tickets] ticket closed", {
            guildId,
            ticketChannelId,
            closedBy: ctx.author?.id,
        });

    }
}