import { id_exists, resolveAndInvoke } from "@/modules/ui";
import { ComponentCommand, type ComponentContext } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";

export default class UIMentionableSelectHandler extends ComponentCommand {
    componentType = "MentionableSelect" as const;

    filter(ctx: ComponentContext<"MentionableSelect">) {
        return id_exists(ctx.customId);
    }

    async run(ctx: ComponentContext<"MentionableSelect">) {
        const ok = await resolveAndInvoke(ctx.customId, ctx);
        if (!ok) {
            await ctx.write({
                content: "This mentionable select menu is no longer active.",
                flags: MessageFlags.Ephemeral,
            });
        }
    }
}
