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
import { get_data_api, toUserId } from "@/modules/flat_api";
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
    const userId = toUserId(user.id);
    const store = get_data_api();
    const existingWarns = await store.listUserWarns(userId);
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

    await store.addUserWarn(userId, warn);

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

