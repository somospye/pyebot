import type { CommandContext } from "seyfert";
import {
    ActionRow,
    ChannelSelectMenu,
    Declare,
    SubCommand,
} from "seyfert";
import { UI } from "@/modules/ui";
import { ChannelType, MessageFlags } from "seyfert/lib/types";

@Declare({
    name: "channel-menu",
    description: "Ejemplo rapido de ChannelSelectMenu",
})
export default class UIChannelMenuSample extends SubCommand {
    async run(ctx: CommandContext) {
        await new UI<Record<string, never>>(
            {},
            () => {
                const channelSelect = new ChannelSelectMenu()
                    .setPlaceholder("Elige un canal de texto")
                    .setChannelTypes([ChannelType.GuildText])
                    .onSelect("channel_menu_select", async (menuCtx) => {
                        const values = menuCtx.interaction.values ?? [];
                        await menuCtx.write({
                            content: values.length
                                ? `Seleccionaste: ${values.map(id => `<#${id}>`).join(", ")}`
                                : "No seleccionaste ningun canal.",
                            flags: MessageFlags.Ephemeral,
                        });
                    });

                return {
                    content: "Channel select: escoge un canal de texto del servidor.",
                    components: [new ActionRow().addComponents(channelSelect)],
                };
            },
            (msg) => ctx.editOrReply(msg),
        ).send();
    }
}
