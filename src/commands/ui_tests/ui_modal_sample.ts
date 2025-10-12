import { ActionRow, Declare, Modal, TextInput } from "seyfert";
import type { CommandContext } from "seyfert";
import { Button, UI } from "@/modules/ui";
import { ButtonStyle, MessageFlags, TextInputStyle } from "seyfert/lib/types";
import { SubCommand } from "seyfert/lib/commands";

@Declare({
    name: "modal",
    description: "Prueba de modales",
})
export default class UIModalTest extends SubCommand {
    async run(ctx: CommandContext) {
        await new UI<{ modal_submitted: boolean }>(
            { modal_submitted: false },
            (state) => {
                const nameInput = new TextInput()
                    .setCustomId("name")
                    .setStyle(TextInputStyle.Short)
                    .setLabel("Name");

                const modalRow = new ActionRow<TextInput>().setComponents([nameInput]);

                const modal = new Modal()
                    .setCustomId("mymodal")
                    .setTitle("My Modal")
                    .addComponents(modalRow)
                    .run(async (modalCtx) => {
                        const name = modalCtx.getInputValue("name");
                        await modalCtx.write({
                            content: `You submitted: Name = ${name}`,
                            flags: MessageFlags.Ephemeral,
                        });
                    });

                const openModalButton = new Button({
                    label: "Open Modal",
                    style: ButtonStyle.Primary,
                })
                    .setDisabled(state.modal_submitted)
                    .opens(modal, async () => {
                        state.modal_submitted = true;
                    });

                const row = new ActionRow().addComponents(openModalButton);
                return { content: "Click to open modal!", components: [row] };
            },
            async (msg) => {
                await ctx.editOrReply(msg);
            },
        ).send();
    }
}
