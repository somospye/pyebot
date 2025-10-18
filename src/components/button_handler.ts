import { id_exists, resolveAndInvoke } from "@/modules/ui";
import { ComponentCommand, type ComponentContext } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";

export default class UIButtonHandler extends ComponentCommand {
    componentType = "Button" as const;

    filter(ctx: ComponentContext<"Button">) {
        return id_exists(ctx.customId);
    }

    async run(ctx: ComponentContext<"Button">) {

        // Check if id has "defer" on it
        if (ctx.customId.includes("defer")) {
            await ctx.deferUpdate();
        }

        const ok = await resolveAndInvoke(ctx.customId, ctx);
        if (!ok) {
            await ctx.write({
                content: "This button is no longer active.",
                flags: MessageFlags.Ephemeral,
            });
        }
    }
}