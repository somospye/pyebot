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
import type { Warn } from "@/schemas/userSchema";

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
export class AddCommand extends SubCommand {
  async run(ctx: GuildCommandContext<typeof options>) {
    const { user, reason } = ctx.options;
    const userRepository = ctx.db.repositories.user;

    const hasUser = await userRepository.has(user.id);
    if (!hasUser) userRepository.create(user.id);

    const userDb = await userRepository.get(user.id);
    const warnsCount = userDb.warns ? userDb.warns.length : 0;

    const finalReason = reason || "Razón no especificada";

    const warn: Warn = {
      reason: finalReason,
      warn_id: warnsCount + 1,
      moderator: ctx.author.id,
      timestamp: new Date().toISOString(),
    };

    await userRepository.addWarn(user.id, warn);

    const successEmbed = new Embed({
      title: "Usuario warneado",
      description: `
            ✓ Se añadió un warn al usuario **${user.username}**.
            
            **Razón:** ${finalReason}
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
