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
import { type UserId } from "@/modules/flat_api";
import { listWarns, removeWarn } from "@/modules/moderation/warns";
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
    const warnId = warn_id.toLowerCase();

    if (!isValidWarnId(warnId)) {
      await ctx.write({
        content:
          "El ID del warn no es valido. Debe tener 5 caracteres alfanumericos sin confusiones (ej. pyebt).",
      });
      return;
    }

    const userId = user.id as UserId;
    const warns = await listWarns(userId);

    if (warns.length === 0) {
      await ctx.write({ content: "El usuario no tiene warns para remover." });
      return;
    }

    const exists = warns.some((warn) => warn.warn_id === warnId);
    if (!exists) {
      await ctx.write({
        content: `No se encontro un warn con el ID ${warnId.toUpperCase()}.`,
      });
      return;
    }

    try {
      await removeWarn(userId, warnId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      await ctx.write({
        content: `Error al remover el warn: ${message}`,
      });
      return;
    }

    const successEmbed = new Embed({
      title: "Usuario unwarneado",
      description: `Se removio el warn **${warnId.toUpperCase()}** del usuario **${user.username}**.`,
      color: EmbedColors.Green,
      footer: {
        text: `Unwarneado por ${ctx.author.username}`,
        icon_url: ctx.author.avatarURL() || undefined,
      },
    });

    await ctx.write({ embeds: [successEmbed] });
  }
}
