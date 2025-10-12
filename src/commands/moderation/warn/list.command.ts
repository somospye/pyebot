import type { Guild, GuildCommandContext } from "seyfert";
import { createUserOption, Declare, Embed, Options, SubCommand } from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
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
    const userRepository = ctx.db.repositories.user;

    const guild = await ctx.guild();

    const exists = await userRepository.has(user.id);
    if (!exists) {
      await userRepository.create(user.id);
      return ctx.write({ content: "✗ El usuario no tiene warns para ver." });
    }

    const userDb = await userRepository.get(user.id);
    if (!userDb) {
      return ctx.write({ content: "✗ No se pudo obtener la información del usuario." });
    }
    const warns = userDb.warns ?? [];

    if (warns.length === 0) {
      return ctx.write({ content: "✗ El usuario no tiene warns para ver." });
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
        return `**Warn ID**: \`${warnId}\`\n**Razón:** ${warn.reason}\n**Moderador:** ${moderator}\n**Fecha:** ${date}`;
      }),
    );

    return warnEntries.join("\n\n");
  }
}
