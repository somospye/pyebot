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
import { addWarn, listWarns } from "@/modules/moderation/warns";
import type { Warn } from "@/schemas/user";
import { generateWarnId } from "@/utils/warnId";

const options = {
  user: createUserOption({
    description: "Usuario a warnear",
    required: true,
  }),
  reason: createStringOption({
    description: "Razon del warn",
    required: false,
  }),
};

@Declare({
  name: "add",
  description: "Anadir un warn a un usuario",
})
@Options(options)
export default class AddWarnCommand extends SubCommand {
  async run(ctx: GuildCommandContext<typeof options>) {
    const { user, reason } = ctx.options;
    const userId = user.id as UserId;
    const existingWarns = await listWarns(userId);
    const existingIds = new Set(existingWarns.map((warn) => warn.warn_id));

    let warnId = generateWarnId();
    while (existingIds.has(warnId)) {
      warnId = generateWarnId();
    }

    const finalReason = reason || "Razon no especificada";

    const warn: Warn = {
      reason: finalReason,
      warn_id: warnId,
      moderator: ctx.author.id,
      timestamp: new Date().toISOString(),
    };

    await addWarn(userId, warn);

    const successEmbed = new Embed({
      title: "Usuario warneado",
      description: [
        `Se anadio un warn al usuario **${user.username}**.`,
        "",
        `**Razon:** ${finalReason}`,
        `**ID del warn:** ${warnId.toUpperCase()}`,
      ].join("\n"),
      color: EmbedColors.Green,
      footer: {
        text: `Warneado por ${ctx.author.username}`,
        icon_url: ctx.author.avatarURL() || undefined,
      },
    });

    await ctx.write({ embeds: [successEmbed] });
  }
}
