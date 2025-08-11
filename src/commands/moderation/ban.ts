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
    required: true,
  }),
};

@Declare({
  name: "ban",
  description: "Banear a un usuario del servidor",
  defaultMemberPermissions: ["BanMembers"],
  botPermissions: ["BanMembers"],
  contexts: ["Guild"],
  integrationTypes: ["GuildInstall"],
})
@Options(options)
export default class BanCommand extends Command {
  async run(ctx: GuildCommandContext<typeof options>) {
    const { user, reason = "Razón no especificada" } = ctx.options;

    if (ctx.author.id === user.id)
      return ctx.write({
        content: "✗ No podés banearte a vos mismo.",
      });

    const targetMember =
      user instanceof InteractionGuildMember ? user : undefined;

    if (!targetMember)
      return ctx.write({
        content: "✗ No se pudo encontrar al miembro a banear en el servidor.",
      });

    if (!(await targetMember.moderatable()))
      return ctx.write({
        content:
          "✗ No podés banear a un usuario con un rol igual o superior al tuyo.",
      });

    const text = `${reason} | Baneado por ${ctx.author.username}`;

    await ctx.client.bans.create(ctx.guildId, user.id, {}, text);

    // TODO: logging

    const successEmbed = new Embed({
      title: "Usuario baneado",
      description: `
            ✓ El usuario **${ctx.options.user.username}** fue baneado correctamente.
            
            **Razón:** ${reason}
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
