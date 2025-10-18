import type { CommandContext } from "seyfert";
import {
    ActionRow,
    Declare,
    SubCommand,
    UserSelectMenu,
} from "seyfert";
import { UI } from "@/modules/ui";
import { MessageFlags } from "seyfert/lib/types";

@Declare({
    name: "user-menu",
    description: "Ejemplo rapido de UserSelectMenu",
})
export default class UIUserMenuSample extends SubCommand {
    async run(ctx: CommandContext) {
        await new UI<Record<string, never>>(
            {},
            () => {
                const userSelect = new UserSelectMenu()
                    .setPlaceholder("Selecciona usuarios")
                    .setValuesLength({ min: 1, max: 2 })
                    .onSelect("user_menu_select", async (menuCtx) => {
                        const users = menuCtx.interaction.values ?? [];
                        await menuCtx.write({
                            content: users.length
                                ? `Usuarios elegidos: ${users.map(id => `<@${id}>`).join(", ")}`
                                : "No seleccionaste ningun usuario.",
                            flags: MessageFlags.Ephemeral,
                        });
                    });

                return {
                    content: "User select: elige hasta dos usuarios del servidor.",
                    components: [new ActionRow().addComponents(userSelect)],
                };
            },
            (msg) => ctx.editOrReply(msg),
        ).send();
    }
}
