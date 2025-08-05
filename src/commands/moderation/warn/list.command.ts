import type { Guild, GuildCommandContext } from "seyfert";
import { createUserOption, Declare, Embed, Options, SubCommand } from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
import type { Warn } from "@/schemas/userSchema";

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
export class ListCommand extends SubCommand {
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
    const fetchMemberName = async (id: string) => {
      try {
        const member = await guild.members.fetch(id);
        return member.name;
      } catch {
        return "Desconocido";
      }
    };

    const warnEntries = await Promise.all(
      warns.map(async (warn) => {
        const moderator = await fetchMemberName(warn.moderator);
        const date = new Date(warn.timestamp).toLocaleString();

        return `__Warn número (ID) ${warn.warn_id}:__\n**Razón:** ${warn.reason}\n**Moderador:** ${moderator}\n**Fecha:** ${date}`;
      }),
    );

    return warnEntries.join("\n\n");
  }
}
