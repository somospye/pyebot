import type { GuildCommandContext } from "seyfert";
import { Command, createStringOption, Declare, Embed, Options } from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
import { parse } from "@/utils/ms";

const options = {
  time: createStringOption({
    description: "¿Cuánto tiempo de mute querés? (ej. 10min)",
    required: true,
  }),
};

@Declare({
  name: "selfmute",
  description: "Darse mute a sí mismo",
  contexts: ["Guild"],
  integrationTypes: ["GuildInstall"],
})
@Options(options)
export default class SelfMuteCommand extends Command {
  async run(ctx: GuildCommandContext<typeof options>) {
    const time = parse(ctx.options.time);
    if (time === undefined)
      return await ctx.write({
        content:
          "✗ Formato de tiempo invalido. **Ejemplos válidos:** 10min, 1h, 3d, 2m, 5s.",
      });

    const moderatable = await ctx.member.moderatable();
    if (!moderatable)
      return await ctx.write({
        content: "✗ No tengo los permisos suficientes.",
      });

    ctx.member.timeout(time, `Comando self-mute | Tiempo: ${time}`);

    const successEmbed = new Embed({
      title: "Self mute",
      description: `
      ✓ **${ctx.author.username}** se dió mute a sí mismo.
      
      **Tiempo:** ${time}
      `,
      color: EmbedColors.Green,
    });

    await ctx.write({ embeds: [successEmbed] });
  }
}
