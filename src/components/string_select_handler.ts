import { id_exists, resolveAndInvoke } from "@/modules/ui";
import { ComponentCommand, type ComponentContext } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";

export default class UIStringSelectHandler extends ComponentCommand {
    componentType = "StringSelect" as const;

    filter(ctx: ComponentContext<"StringSelect">) {
        return id_exists(ctx.customId);
    }

    async run(ctx: ComponentContext<"StringSelect">) {
        // await ctx.deferUpdate();
        const ok = await resolveAndInvoke(ctx.customId, ctx);
        if (!ok) {
            await ctx.write({
                content: "This string select menu is no longer active.",
                flags: MessageFlags.Ephemeral,
            });
        }
    }
}
