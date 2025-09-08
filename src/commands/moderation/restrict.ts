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
import {
  RESTRICTED_FORUMS_ROLE_ID,
  RESTRICTED_JOBS_ROLE_ID,
  RESTRICTED_VOICE_ROLE_ID,
} from "@/constants/guild";

const TYPE_TRANSLATIONS: Record<string, string> = {
  forums: "Foros",
  voice: "Voz",
  jobs: "Empleos",
  all: "Todo",
};

const options = {
  user: createUserOption({
    description: "Usuario a restringir",
    required: true,
  }),
  type: createStringOption({
    description: "Tipo de restringir",
    required: true,
    choices: [
      { name: "Foros", value: "forums" },
      { name: "Voz", value: "voice" },
      { name: "Empleos", value: "jobs" },
      { name: "Todo", value: "all" },
    ],
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
    const { user, reason, type } = ctx.options;

    const GuildLogger = await ctx.getGuildLogger();

    if (ctx.author.id === user.id)
      return ctx.write({
        content: "❌ No podés restringirte a vos mismo.",
      });

    const targetMember =
      user instanceof InteractionGuildMember ? user : undefined;

    if (!targetMember)
      return ctx.write({
        content:
          "❌ No se pudo encontrar al miembro a restringir en el servidor.",
      });

    if (!(await targetMember.moderatable()))
      return ctx.write({
        content:
          "❌ No podés restringir a un usuario con un rol igual o superior al tuyo.",
      });

    const roles: Record<string, string | string[]> = {
      jobs: RESTRICTED_JOBS_ROLE_ID,
      forums: RESTRICTED_FORUMS_ROLE_ID,
      voice: RESTRICTED_VOICE_ROLE_ID,
      all: [
        RESTRICTED_JOBS_ROLE_ID,
        RESTRICTED_FORUMS_ROLE_ID,
        RESTRICTED_VOICE_ROLE_ID,
      ],
    };

    if (Array.isArray(roles[type])) {
      await Promise.all(
        roles[type].map((roleId) => targetMember.roles.add(roleId)),
      );
    } else {
      await targetMember.roles.add(roles[type]);
    }

    const successEmbed = new Embed({
      title: "Usuario restringido correctamente",
      description: `
        El usuario **${ctx.options.user.username}** fue restringido exitosamente.

        **Razón:** ${reason}
        **Restricción:** ${TYPE_TRANSLATIONS[type]}
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

    await GuildLogger.banSanctionLog({
      title: "Usuario restringido",
      color: EmbedColors.DarkOrange,
      thumbnail: await user.avatarURL(),
      fields: [
        {
          name: "Usuario",
          value: `${user.username} (${user.id})`,
          inline: true,
        },
        { name: "Razón", value: reason, inline: false },
        { name: "Restricción", value: TYPE_TRANSLATIONS[type], inline: false },
      ],
      footer: {
        text: `${ctx.author.username} (${ctx.author.id})`,
        iconUrl: ctx.author.avatarURL(),
      },
    });
  }
}
