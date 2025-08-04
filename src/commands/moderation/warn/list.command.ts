import type { CommandContext } from "seyfert";
import { Declare, SubCommand } from "seyfert";

@Declare({
  name: "list",
  description: "Ver todos los warns de un usuario",
})
export class ListCommand extends SubCommand {
  run(ctx: CommandContext) {
    ctx.write({ content: "todo" });
  }
}
