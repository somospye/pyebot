import type { GuildCommandContext } from "seyfert";
import {
  createNumberOption,
  createUserOption,
  Declare,
  Embed,
  Options,
  SubCommand,
} from "seyfert";
import { EmbedColors } from "seyfert/lib/common";

const options = {
  user: createUserOption({
    description: "Usuario a unwarnear",
    required: true,
  }),
  warn_id: createNumberOption({
    description: "ID del warn",
    required: true,
  }),
};

@Declare({
  name: "remove",
  description: "Remover un warn a un usuario",
})
@Options(options)
export default class RemoveWarnCommand extends SubCommand {
  async run(ctx: GuildCommandContext<typeof options>) {
    const { user, warn_id } = ctx.options;
    const userRepository = ctx.db.repositories.user;

    const hasUser = await userRepository.has(user.id);
    if (!hasUser) {
      userRepository.create(user.id);

      return ctx.write({
        content: "✗ El usuario no tiene warns para remover.",
      });
    }

    try {
      await userRepository.removeWarn(user.id, warn_id);
    } catch (error) {
      let errorMessage = "Error desconocido";

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      return ctx.write({
        content: `✗ **Error al remover el warn:** ${errorMessage}`,
      });
    }

    const successEmbed = new Embed({
      title: "Usuario unwarneado",
      description: `
            ✓ Se removió un warn al usuario **${user.username}**.
            `,
      color: EmbedColors.Green,
      footer: {
        text: `Unwarneado por ${ctx.author.username}`,
        icon_url: ctx.author.avatarURL() || undefined,
      },
    });

    await ctx.write({ embeds: [successEmbed] });
  }
}
