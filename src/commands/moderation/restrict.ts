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
    description: "Usuario a restringir",
    required: true,
  }),
  reason: createStringOption({
    description: "Razón de la restricción",
    required: true,
  }),
};

@Declare({
  name: "restrict",
  description: "Restringir de los foros y canales a un usuario",
  defaultMemberPermissions: ["MuteMembers"],
  botPermissions: ["ManageRoles"],
  contexts: ["Guild"],
  integrationTypes: ["GuildInstall"],
})
@Options(options)
export default class RestrictCommand extends Command {
  async run(ctx: GuildCommandContext<typeof options>) {
    const { user, reason } = ctx.options;

    if (ctx.author.id === user.id)
      return ctx.write({
        content: "✗ No podés restringirte a vos mismo.",
      });

    const targetMember =
      user instanceof InteractionGuildMember ? user : undefined;

    if (!targetMember)
      return ctx.write({
        content:
          "✗ No se pudo encontrar al miembro a restringir en el servidor.",
      });

    /*
    if (!(await targetMember.moderatable()))
      return ctx.write({
        content:
          "✗ No podés restringir a un usuario con un rol igual o superior al tuyo.",
      });
    */

    const text = `${reason} | Restringido por ${ctx.author.username}`;

    const RESTRICTED_JOBS_ROLE_ID = "984278721055830047";
    const RESTRICTED_FORUMS_ROLE_ID = "1385798023485063369";
    const RESTRICTED_VOICE_ROLE_ID = "1307455233814823014";

    await targetMember.roles.add(RESTRICTED_JOBS_ROLE_ID);
    await targetMember.roles.add(RESTRICTED_FORUMS_ROLE_ID);
    await targetMember.roles.add(RESTRICTED_VOICE_ROLE_ID);

    // TODO: logging

    const successEmbed = new Embed({
      title: "Usuario restringido",
      description: `
            ✓ El usuario **${ctx.options.user.username}** fue restringido correctamente.
            
            **Razón:** ${reason}
            `,
      color: EmbedColors.Green,
      footer: {
        text: `Restringido por ${ctx.author.username}`,
        icon_url: ctx.author.avatarURL() || undefined,
      },
    });

    await ctx.write({
      embeds: [successEmbed],
    });
  }
}
