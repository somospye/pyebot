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
import { generateWarnId } from "@/utils/warnId";

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
export default class AddWarnCommand extends SubCommand {
  async run(ctx: GuildCommandContext<typeof options>) {
    const { user, reason } = ctx.options;
    const userRepository = ctx.db.repositories.user;

    const hasUser = await userRepository.has(user.id);
    if (!hasUser) await userRepository.create(user.id);

    const userDb = await userRepository.get(user.id);
    if (!userDb) {
      await ctx.write({
        content:
          "✗ No se pudo inicializar el usuario en la base de datos. Intenta nuevamente.",
      });
      return;
    }
    const existingWarns = userDb.warns ?? [];
    const existingIds = new Set(existingWarns.map((warn) => warn.warn_id));

    let warnId = generateWarnId();

    // Evitar colisiones; extremadamente improbables
    while (existingIds.has(warnId)) {
      warnId = generateWarnId();
    }

    const finalReason = reason || "Razón no especificada";

    const warn: Warn = {
      reason: finalReason,
      warn_id: warnId,
      moderator: ctx.author.id,
      timestamp: new Date().toISOString(),
    };

    await userRepository.addWarn(user.id, warn);

    const successEmbed = new Embed({
      title: "Usuario warneado",
      description: `
            ✓ Se añadió un warn al usuario **${user.username}**.
            
            **Razón:** ${finalReason}
            **ID del warn:** ${warnId.toUpperCase()}
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
