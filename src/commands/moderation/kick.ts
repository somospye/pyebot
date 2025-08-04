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

const options = {
  user: createUserOption({
    description: "Usuario a expulsar",
    required: true,
  }),
  reason: createStringOption({
    description: "Razón de la expulsión",
    required: false,
  }),
};

@Declare({
  name: "kick",
  description: "Expulsar a un usuario del servidor",
  defaultMemberPermissions: ["KickMembers"],
  botPermissions: ["KickMembers"],
})
@Options(options)
export default class KickCommand extends Command {
  async run(ctx: GuildCommandContext<typeof options>) {
    if (ctx.author.id === ctx.options.user.id)
      return ctx.write({
        content: "✗ No podés expulsarte a vos mismo.",
      });

    const memberHighestRole = ctx.member
      ? await ctx.member.roles.highest()
      : undefined;
    const targetMember =
      ctx.options.user instanceof InteractionGuildMember
        ? ctx.options.user
        : undefined;
    const targetHighestRole = targetMember
      ? await targetMember.roles.highest()
      : undefined;

    if (
      memberHighestRole &&
      targetHighestRole &&
      memberHighestRole.position <= targetHighestRole.position
    )
      return ctx.write({
        content:
          "✗ No podés expulsar a un usuario con un rol igual o superior al tuyo.",
      });

    const reasonOption = ctx.options.reason || "Razón no especificada";
    const reason = `${reasonOption} | Expulsado por ${ctx.author.username}`;

    if (!targetMember) {
      return ctx.write({
        content: "✗ No se pudo encontrar al miembro a expulsar en el servidor.",
      });
    }

    await targetMember.kick(reason);

    // TODO: logging

    const successEmbed = new Embed({
      title: "Usuario expulsado",
      description: `
            ✓ El usuario **${ctx.options.user.username}** fue expulsado correctamente.
            
            **Razón:** ${reasonOption}
            `,
      color: EmbedColors.Green,
      footer: {
        text: `Expulsado por ${ctx.author.username}`,
        icon_url: ctx.author.avatarURL() || undefined,
      },
    });

    await ctx.write({
      embeds: [successEmbed],
    });
  }
}
