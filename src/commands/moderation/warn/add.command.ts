import type { CommandContext } from "seyfert";
import { Declare, SubCommand } from "seyfert";

@Declare({
  name: "add",
  description: "Añadir un warn a un usuario",
})
export class AddCommand extends SubCommand {
  run(ctx: CommandContext) {
    ctx.write({ content: "todo" });
  }
}
