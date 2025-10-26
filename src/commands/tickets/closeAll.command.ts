import {
    Declare,
    type GuildCommandContext,
    SubCommand,
} from "seyfert";

import * as repo from "@/modules/repo";
import { requireGuildId, requireGuildPermission } from "@/utils/commandGuards";


@Declare({
    name: "close-all",
    description: "Cerrar todos los tickets abiertos en el servidor",
})
export default class ConfigTicketsCommand extends SubCommand {
    async run(ctx: GuildCommandContext) {
        const guildId = await requireGuildId(ctx);
        if (!guildId) return;

        const allowed = await requireGuildPermission(ctx, {
            guildId,
            permissions: ["ManageChannels"],
        });
        if (!allowed) return;

        // Ensure guild row exists
        await repo.ensureGuild(guildId);
        
        // Fetch all pending tickets
        const pendingTickets = await repo.getPendingTickets(guildId);

        // TODO: Generate transcript before closing

        // Close each ticket channel
        for (const ticketChannelId of pendingTickets) {
            try {
                const channel = await ctx.client.channels.fetch(ticketChannelId);
                if (channel) {
                    await ctx.client.channels.delete(channel.id);
                }
            } catch (error) {
                ctx.client.logger?.error?.("[tickets] failed to close ticket channel", {
                    error,
                    ticketChannelId,
                });
            }
        }

        // Clear pending tickets in the database
        await repo.setPendingTickets(guildId, (_) => []);

        await ctx.write({
            content: "Todos los tickets abiertos han sido cerrados.",
        });
    }
}
