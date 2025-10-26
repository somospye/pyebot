import type { CommandContext } from "seyfert";
import { Command, Declare } from "seyfert";

@Declare({
    name: "hola",
    description: "Saludar al bot",
})
export default class HolaCommand extends Command {
    async run(ctx: CommandContext) {
        await ctx.write({
            content: `¡Hola, ${ctx.author.username}!`,
        });
    }
}
