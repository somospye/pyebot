import type { CommandContext } from "seyfert";
import {
    ActionRow,
    Declare,
    RoleSelectMenu,
    SubCommand,
} from "seyfert";
import { UI } from "@/modules/ui";
import { MessageFlags } from "seyfert/lib/types";

@Declare({
    name: "role-menu",
    description: "Ejemplo rapido de RoleSelectMenu",
})
export default class UIRoleMenuSample extends SubCommand {
    async run(ctx: CommandContext) {
        await new UI<Record<string, never>>(
            {},
            () => {
                const roleSelect = new RoleSelectMenu()
                    .setPlaceholder("Selecciona roles")
                    .setValuesLength({ min: 1, max: 3 })
                    .onSelect("role_menu_select", async (menuCtx) => {
                        const values = menuCtx.interaction.values ?? [];
                        await menuCtx.write({
                            content: values.length
                                ? `Roles elegidos: ${values.map(id => `<@&${id}>`).join(", ")}`
                                : "No elegiste ningun rol.",
                            flags: MessageFlags.Ephemeral,
                        });
                    });

                return {
                    content: "Role select: marca uno o varios roles del servidor.",
                    components: [new ActionRow().addComponents(roleSelect)],
                };
            },
            (msg) => ctx.editOrReply(msg),
        ).send();
    }
}
