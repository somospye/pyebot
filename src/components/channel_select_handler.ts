import { id_exists, resolveAndInvoke } from "@/modules/ui";
import { ComponentCommand, type ComponentContext } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";

export default class UIChannelSelectHandler extends ComponentCommand {
    componentType = "ChannelSelect" as const;

    filter(ctx: ComponentContext<"ChannelSelect">) {
        return id_exists(ctx.customId);
    }

    async run(ctx: ComponentContext<"ChannelSelect">) {
        const ok = await resolveAndInvoke(ctx.customId, ctx);
        if (!ok) {
            await ctx.write({
                content: "This channel select menu is no longer active.",
                flags: MessageFlags.Ephemeral,
            });
        }
    }
}
