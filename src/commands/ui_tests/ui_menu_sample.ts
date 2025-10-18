import type { CommandContext } from "seyfert";
import { ActionRow, Declare, StringSelectMenu, StringSelectOption, SubCommand } from "seyfert";
import { UI} from "@/modules/ui";
import {  MessageFlags } from "seyfert/lib/types";

@Declare({
    name: "menu",
    description: "Prueba de menu desplegable",
})
export default class UIMenuTest extends SubCommand {
    async run(ctx: CommandContext) {


        new UI<{ }>(
            // Estado inicial, estos valoren son reactivos, si se actualizan, el mensaje se actualiza automáticamente
            {},

            // Función que construye el mensaje a enviar, recibe el estado y una función para forzar actualización
            // state = estado reactivo
            // update = función para forzar actualización (en caso de ser necesario, por alguna razon...)
            (_state, _update) => {
                const row = new ActionRow().addComponents(
                    new StringSelectMenu()
                        .setPlaceholder("Selecciona una opción")
                        .setValuesLength({
                            min: 1,
                            max: 1
                        })

                        .addOption(
                            new StringSelectOption()
                                .setLabel("Manzana")
                                .setValue("apple")
                                .setDescription("Una manzana fresca")
                                .setEmoji("🍎")
                        )

                        .addOption(
                            new StringSelectOption()
                                .setLabel("Banana")
                                .setValue("banana")
                                .setDescription("Una banana amarilla")
                                .setEmoji("🍌")
                        )

                        .addOption(
                            new StringSelectOption()
                                .setLabel("Cereza")
                                .setValue("cherry")
                                .setDescription("Unas cerezas rojas")
                                .setEmoji("🍒")
                        )   

                        .onSelect("fruit_select", async (menu_ctx) => {
                            // type: menu_ctx: ComponentContext<"ChannelSelect", never> | ComponentContext<"MentionableSelect", never> | ComponentContext<"RoleSelect", never> | ComponentContext<"GuildForumTagSelect", never> | ComponentContext<"UserSelect", never>
                            const values = menu_ctx.interaction.values; // Array de valores seleccionados
                            if (!values) {
                                await menu_ctx.write({
                                    content: "No has seleccionado nada.",
                                    flags: MessageFlags.Ephemeral // Ephemeral
                                });
                                return;
                            }
                            await menu_ctx.write({
                                content: `Has seleccionado: ${values.join(", ")}`,
                                flags: MessageFlags.Ephemeral
                            });
                        })
                );

                return {
                    content: "Selecciona una opción del menú desplegable:",
                    components: [row]
                }

            },

            async msg => { await ctx.editOrReply(msg); }
        ).send();


        // await ctx.write(ui.build());
    }
}
