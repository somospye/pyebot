import { id_exists, resolveAndInvoke } from "@/modules/ui";
import { ComponentCommand, type ComponentContext } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";

export default class UIRoleSelectHandler extends ComponentCommand {
    componentType = "RoleSelect" as const;

    filter(ctx: ComponentContext<"RoleSelect">) {
        return id_exists(ctx.customId);
    }

    async run(ctx: ComponentContext<"RoleSelect">) {
        const ok = await resolveAndInvoke(ctx.customId, ctx);
        if (!ok) {
            await ctx.write({
                content: "This role select menu is no longer active.",
                flags: MessageFlags.Ephemeral,
            });
        }
    }
}
