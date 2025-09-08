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
  contexts: ["Guild"],
  integrationTypes: ["GuildInstall"],
})
@Options(options)
export default class KickCommand extends Command {
  async run(ctx: GuildCommandContext<typeof options>) {
    const { user, reason = "Razón no especificada" } = ctx.options;
    const GuildLogger = await ctx.getGuildLogger();

    if (ctx.author.id === user.id)
      return ctx.write({
        content: "❌ No podés expulsarte a vos mismo.",
      });

    const targetMember =
      user instanceof InteractionGuildMember ? user : undefined;

    if (!targetMember)
      return ctx.write({
        content:
          "❌ No se pudo encontrar al miembro a expulsar en el servidor.",
      });

    if (!(await targetMember.moderatable()))
      return ctx.write({
        content:
          "❌ No podés expulsar a un usuario con un rol igual o superior al tuyo.",
      });

    const text = `${reason} | Expulsado por ${ctx.author.username}`;

    await targetMember.kick(text);

    const successEmbed = new Embed({
      title: "Usuario expulsado correctamente",
      description: `
        El usuario **${ctx.options.user.username}** fue expulsado exitosamente.

        **Razón:** ${reason}
      `,
      color: EmbedColors.Green,
      footer: {
        text: `Expulsado por ${ctx.author.username}`,
        icon_url: ctx.author.avatarURL(),
      },
    });

    await ctx.write({
      embeds: [successEmbed],
    });

    await GuildLogger.banSanctionLog({
      title: "Usuario expulsado",
      color: EmbedColors.DarkOrange,
      thumbnail: await user.avatarURL(),
      fields: [
        {
          name: "Usuario",
          value: `${user.username} (${user.id})`,
          inline: true,
        },
        { name: "Razón", value: reason, inline: false },
      ],
      footer: {
        text: `${ctx.author.username} (${ctx.author.id})`,
        iconUrl: ctx.author.avatarURL(),
      },
    });
  }
}
