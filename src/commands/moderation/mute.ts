import type { GuildCommandContext } from "seyfert";
import {
  Command,
  createStringOption,
  createUserOption,
  Declare,
  Embed,
  InteractionGuildMember,
  Options,
} from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
import { isValid, parse } from "@/utils/ms";

const options = {
  user: createUserOption({
    description: "Usuario a silenciar",
    required: true,
  }),
  time: createStringOption({
    description: "¿Cuánto tiempo de mute querés? (ej. 10min)",
    required: true,
  }),
  reason: createStringOption({
    description: "Razón del mute",
    required: false,
  }),
};

@Declare({
  name: "mute",
  description: "Silencia a un usuario",
  defaultMemberPermissions: ["MuteMembers"],
  botPermissions: ["MuteMembers"],
  contexts: ["Guild"],
  integrationTypes: ["GuildInstall"],
})
@Options(options)
export default class MuteCommand extends Command {
  async run(ctx: GuildCommandContext<typeof options>) {
    const { user, time, reason = "Razón no especificada" } = ctx.options;

    if (!isValid(time))
      return await ctx.write({
        content:
          "✗ Formato de tiempo invalido. **Ejemplos válidos:** 10min, 1h, 3d, 2m, 5s.",
      });

    if (ctx.author.id === user.id)
      return ctx.write({
        content: "✗ No podés silenciarte a vos mismo.",
      });

    const targetMember =
      user instanceof InteractionGuildMember ? user : undefined;

    if (!targetMember)
      return ctx.write({
        content:
          "✗ No se pudo encontrar al miembro a silenciar en el servidor.",
      });

    if (!(await targetMember.moderatable()))
      return ctx.write({
        content:
          "✗ No podés silenciar a un usuario con un rol igual o superior al tuyo.",
      });

    const text = `${reason} | Silenciado por ${ctx.author.username}`;

    const milliseconds = parse(time) || 0;
    await targetMember.timeout(milliseconds, text);

    // TODO: logging

    const successEmbed = new Embed({
      title: "Usuario silenciado",
      description: `
            ✓ El usuario **${ctx.options.user.username}** fue silenciado correctamente.
            
            **Razón:** ${reason}
            `,
      color: EmbedColors.Green,
      footer: {
        text: `Silenciado por ${ctx.author.username}`,
        icon_url: ctx.author.avatarURL(),
      },
    });

    await ctx.write({
      embeds: [successEmbed],
    });
  }
}
