import type { CommandContext } from "seyfert";
import { Declare, SubCommand } from "seyfert";

@Declare({
  name: "remove",
  description: "Remover un warn a un usuario",
})
export class RemoveCommand extends SubCommand {
  run(ctx: CommandContext) {
    ctx.write({ content: "todo" });
  }
}
