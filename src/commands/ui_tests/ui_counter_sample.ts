import { ActionRow, CommandContext, Declare, SubCommand } from "seyfert";
import { Button, UI } from "@/modules/ui";
import { ButtonStyle } from "seyfert/lib/types";

@Declare({
    name: "counter",
    description: "Simple counter (click +1 each time you press the button)",
})
export default class UICounterTest extends SubCommand {
    async run(ctx: CommandContext) {
        await new UI<{ count: number }>(
            { count: 0 },
            (state) => {
                const content = `El boton ha sido presionado **${state.count}** veces.`;

                const increment = new Button()
                    .setLabel("+1")
                    .setStyle(ButtonStyle.Primary)
                    .onClick("increment", () => { state.count += 1; });

                return { content, components: [new ActionRow().addComponents(increment)] };
            },
            (msg) => ctx.editOrReply(msg),
        ).send()
    }
};