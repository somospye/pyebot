import type { CommandContext } from "seyfert";
import { Command, Declare } from "seyfert";

@Declare({
  name: "ping",
  description: "Mostrar la latencia con Discord",
})
export default class PingCommand extends Command {
  async run(ctx: CommandContext) {
    const ping = ctx.client.gateway.latency;

    await ctx.write({
      content: `La latencia es \`${ping}ms\``,
    });
  }
}
