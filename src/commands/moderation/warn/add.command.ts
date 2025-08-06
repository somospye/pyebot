import type { GuildCommandContext } from "seyfert";
import {
  createStringOption,
  createUserOption,
  Declare,
  Embed,
  Options,
  SubCommand,
} from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
import type { Warn } from "@/schemas/user";

const options = {
  user: createUserOption({
    description: "Usuario a warnear",
    required: true,
  }),
  reason: createStringOption({
    description: "Razón del warn",
    required: false,
  }),
};

@Declare({
  name: "add",
  description: "Añadir un warn a un usuario",
})
@Options(options)
export class AddWarnCommand extends SubCommand {
  async run(ctx: GuildCommandContext<typeof options>) {
    const { user, reason = "Razón no especificada" } = ctx.options;
    const userRepository = ctx.db.repositories.user;

    const hasUser = await userRepository.has(user.id);
    if (!hasUser) userRepository.create(user.id);

    const userDb = await userRepository.get(user.id, false);
    const warnsCount = userDb.warns?.length ?? 0;

    const warn: Warn = {
      reason,
      warn_id: warnsCount + 1,
      moderator: ctx.author.id,
      timestamp: new Date().toISOString(),
    };

    await userRepository.addWarn(user.id, warn);

    const successEmbed = new Embed({
      title: "Usuario warneado",
      description: `
            ✓ Se añadió un warn al usuario **${user.username}**.
            
            **Razón:** ${reason}
            `,
      color: EmbedColors.Green,
      footer: {
        text: `Warneado por ${ctx.author.username}`,
        icon_url: ctx.author.avatarURL() || undefined,
      },
    });

    await ctx.write({ embeds: [successEmbed] });
  }
}
