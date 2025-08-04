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
    description: "Usuario a banear",
    required: true,
  }),
  reason: createStringOption({
    description: "Razón del baneo",
    required: false,
  }),
};

@Declare({
  name: "ban",
  description: "Banear a un usuario del servidor",
  defaultMemberPermissions: ["BanMembers"],
  botPermissions: ["BanMembers"],
})
@Options(options)
export default class BanCommand extends Command {
  async run(ctx: GuildCommandContext<typeof options>) {
    const guild = await ctx.guild();

    if (ctx.author.id === ctx.options.user.id)
      return ctx.write({
        content: "✗ No podés banearte a vos mismo.",
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
          "✗ No podés banear a un usuario con un rol igual o superior al tuyo.",
      });

    const reasonOption = ctx.options.reason || "Razón no especificada";
    const reason = `${reasonOption} | Baneado por ${ctx.author.username}`;

    await guild.bans.create(ctx.options.user.id, {}, reason);

    // TODO: logging

    const successEmbed = new Embed({
      title: "Usuario baneado",
      description: `
            ✓ El usuario **${ctx.options.user.username}** fue baneado correctamente.
            
            **Razón:** ${reasonOption}
            `,
      color: EmbedColors.Green,
      footer: {
        text: `Baneado por ${ctx.author.username}`,
        icon_url: ctx.author.avatarURL() || undefined,
      },
    });

    await ctx.write({
      embeds: [successEmbed],
    });
  }
}
