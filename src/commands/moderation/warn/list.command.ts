import type { Guild, GuildCommandContext } from "seyfert";
import { createUserOption, Declare, Embed, Options, SubCommand } from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
import { get_data_api, toUserId } from "@/modules/flat_api";
import type { Warn } from "@/schemas/user";
import { getMemberName } from "@/utils/guild";

const options = {
  user: createUserOption({
    description: "Usuario a ver sus warns",
    required: true,
  }),
};

@Declare({
  name: "list",
  description: "Ver todos los warns de un usuario",
})
@Options(options)
export default class ListWarnCommand extends SubCommand {
  async run(ctx: GuildCommandContext<typeof options>) {
    const { user } = ctx.options;
    const userId = toUserId(user.id);

    const guild = await ctx.guild();
    const store = get_data_api();
    const warns = await store.listUserWarns(userId);

    if (warns.length === 0) {
      await ctx.write({ content: "El usuario no tiene warns para ver." });
      return;
    }

    const warnsText = await this.formatWarns(warns, guild);

    const embed = new Embed({
      title: "Lista de warns",
      description: `**${user.username}** tiene ${warns.length} warns.\n\n${warnsText}`,
      color: EmbedColors.Blue,
    });

    await ctx.write({ embeds: [embed] });
  }

  private async formatWarns(
    warns: Warn[],
    guild: Awaited<Guild<"cached" | "api">>,
  ): Promise<string> {
    const warnEntries = await Promise.all(
      warns.map(async (warn) => {
        const moderator = await getMemberName(warn.moderator, guild);
        const date = new Date(warn.timestamp).toLocaleString();
        const warnId = warn.warn_id.toUpperCase();

        return [
          `**Warn ID**: \`${warnId}\``,
          `**Razon:** ${warn.reason}`,
          `**Moderador:** ${moderator}`,
          `**Fecha:** ${date}`,
        ].join("\n");
      }),
    );

    return warnEntries.join("\n\n");
  }
}

