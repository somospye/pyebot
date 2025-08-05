import type { GuildCommandContext } from "seyfert";
import { Command, createStringOption, Declare, Embed, Options } from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
import ms from "@/utils/ms";

const options = {
  time: createStringOption({
    description: "¿Cuánto tiempo de mute querés? (ej. 10min)",
    required: true,
  }),
};

@Declare({
  name: "selfmute",
  description: "Darse mute a sí mismo",
})
@Options(options)
export default class SelfMuteCommand extends Command {
  async run(ctx: GuildCommandContext<typeof options>) {
    const { time } = ctx.options;

    if (!ms.isValid(time))
      return await ctx.write({
        content:
          "✗ Formato de tiempo invalido. **Ejemplos válidos:** 10min, 1h, 3d, 2m, 5s.",
      });

    const moderatable = await ctx.member.moderatable();
    if (!moderatable)
      return await ctx.write({
        content: "✗ No tengo los permisos suficientes.",
      });

    const milliseconds = ms.parse(time) || 0;
    ctx.member.timeout(milliseconds, `Comando self-mute | Tiempo: ${time}`);

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
