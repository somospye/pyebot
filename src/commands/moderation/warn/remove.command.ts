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
import { isValidWarnId } from "@/utils/warnId";

const options = {
  user: createUserOption({
    description: "Usuario a unwarnear",
    required: true,
  }),
  warn_id: createStringOption({
    description: "ID del warn (ej. pyebt)",
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

    const warnId = warn_id.toLowerCase();

    if (!isValidWarnId(warnId)) {
      return ctx.write({
        content:
          "✗ El ID del warn no es válido. Debe tener 5 caracteres alfanuméricos sin confusiones (ej. pyebt).",
      });
    }

    const hasUser = await userRepository.has(user.id);
    if (!hasUser) {
      await userRepository.create(user.id);

      return ctx.write({
        content: "✗ El usuario no tiene warns para remover.",
      });
    }

    try {
      await userRepository.removeWarn(user.id, warnId);
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
            ✓ Se removió el warn **${warnId.toUpperCase()}** del usuario **${user.username}**.
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
