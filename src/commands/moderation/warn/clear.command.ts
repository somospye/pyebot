import type { GuildCommandContext } from "seyfert";
import { createUserOption, Declare, Embed, Options, SubCommand } from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
import { type UserId } from "@/modules/repo";
import { clearWarns, listWarns } from "@/modules/moderation/warns";

const options = {
  user: createUserOption({
    description: "Usuario cuyos warns se limpiaran",
    required: true,
  }),
};

@Declare({
  name: "clear",
  description: "Eliminar todos los warns de un usuario",
})
@Options(options)
export default class ClearWarnCommand extends SubCommand {
  async run(ctx: GuildCommandContext<typeof options>) {
    const { user } = ctx.options;
    const userId = user.id as UserId;

    const warns = await listWarns(userId);
    if (warns.length === 0) {
      await ctx.write({
        content: "No hay warns registrados para este usuario.",
      });
      return;
    }

    await clearWarns(userId);

    const embed = new Embed({
      title: "Warns eliminados",
      description: `Se eliminaron ${warns.length} warns del usuario **${user.username}**.`,
      color: EmbedColors.Green,
      footer: {
        text: `Accion ejecutada por ${ctx.author.username}`,
        icon_url: ctx.author.avatarURL() || undefined,
      },
    });

    await ctx.write({ embeds: [embed] });
  }
}
