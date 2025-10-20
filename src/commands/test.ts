import type { CommandContext } from "seyfert";
import { Command, Declare, Embed } from "seyfert";

import { get_data_api, toGuildId } from "@/modules/flat_api";

@Declare({
  name: "test",
  description: "Comando de prueba",
})
export default class TestCommand extends Command {
  async run(ctx: CommandContext) {
    if (!ctx.guildId) {
      await ctx.write({
        content:
          "[!] Este comando solo puede ejecutarse dentro de un servidor.",
      });
      return;
    }

    const guildId = toGuildId(ctx.guildId);
    const store = get_data_api();
    await store.ensureGuild(guildId);
    const channels = await store.getGuildChannels(guildId);

    // list channels
    const embed = new Embed()
      .setTitle("Canales del servidor")
      .setDescription("Lista de canales gestionados y principales")
      .setColor("Blurple");

    embed.setFields(
      Object.entries(channels.core).map(([key, value]) => ({
        name: key,
        value: `${value.label} : <#${value.channelId}>`,
        inline: true,
      })),
    );

    await ctx.write({ embeds: [embed] });
  }
}

