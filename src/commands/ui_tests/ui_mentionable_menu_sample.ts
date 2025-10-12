import type { CommandContext } from "seyfert";
import {
    ActionRow,
    Declare,
    MentionableSelectMenu,
    SubCommand,
} from "seyfert";
import { UI } from "@/modules/ui";
import { MessageFlags } from "seyfert/lib/types";

@Declare({
    name: "mentionable-menu",
    description: "Ejemplo rapido de MentionableSelectMenu",
})
export default class UIMentionableMenuSample extends SubCommand {
    async run(ctx: CommandContext) {
        await new UI<Record<string, never>>(
            {},
            () => {
                const mentionableSelect = new MentionableSelectMenu()
                    .setPlaceholder("Usuarios o roles")
                    .setValuesLength({ min: 1, max: 3 })
                    .onSelect("mentionable_menu_select", async (menuCtx) => {
                        const values = menuCtx.interaction.values ?? [];
                        await menuCtx.write({
                            content: values.length
                                ? `Elegiste: ${values.join(", ")}`
                                : "No seleccionaste nada.",
                            flags: MessageFlags.Ephemeral,
                        });
                    });

                return {
                    content: "Mentionable select: puedes elegir usuarios o roles.",
                    components: [new ActionRow().addComponents(mentionableSelect)],
                };
            },
            (msg) => ctx.editOrReply(msg),
        ).send();
    }
}
