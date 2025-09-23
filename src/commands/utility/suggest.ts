import type { CommandContext, GuildCommandContext } from "seyfert";
import {
  Command,
  createStringOption,
  Declare,
  Embed,
  Middlewares,
  Options,
} from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
import { Cooldown, CooldownType } from "@/modules/cooldown";
import { GuildChannelsRepository } from "@/modules/guild-channels";

const options = {
  suggest: createStringOption({
    description: "¿qué tienes en mente para el servidor?",
    min_length: 16,
    required: true,
  }),
};

@Declare({
  name: "sugerir",
  description: "Sugerir mejoras para el servidor",
  contexts: ["Guild"],
  integrationTypes: ["GuildInstall"],
})
@Cooldown({
  type: CooldownType.User,
  interval: 5_000 * 60,
  uses: {
    default: 1,
  },
})
@Middlewares(["cooldown"])
@Options(options)
export default class SuggestCommand extends Command {
  async run(ctx: GuildCommandContext<typeof options>) {
    const { suggest } = ctx.options;

    if (!suggest) {
      console.error("Suggest: no se pudo obtener sugerencia.");
      return;
    }

    const guildId = ctx.guildId;
    if (!guildId) {
      console.error("Suggest: no se pudo obtener ID de la guild.");
      return;
    }

    const guild = await new GuildChannelsRepository().getGuild(guildId);
    const suggest_channel = guild?.channels.managed.suggestions;

    if (!suggest_channel) {
      console.error("Suggest: no se pudo obtener canal de sugerencias");
      return;
    }

    const suggestEmbed = new Embed({
      title: "Nueva sugerencia !",
      author: {
        name: ctx.author.username,
        icon_url: ctx.author.avatarURL(),
      },
      description: `${suggest}`,
      color: EmbedColors.Aqua,
      footer: {
        text: `Puedes votar a favor o en contra de esta sugerencia.`,
      },
    });

    const message = await ctx.client.messages.write(suggest_channel.channelId, {
      embeds: [suggestEmbed],
    });

    await message.react("✅");
    await message.react("❌");

    const thread = await ctx.client.messages.thread(
      message.channelId,
      message.id,
      {
        name: `Sugerencia de ${ctx.author.username}`,
      },
    );

    await ctx.client.messages.write(thread.id, {
      content: `<@${ctx.member?.user.id}>`,
    });

    await ctx.write({
      content: "✅ Sugerencia enviada correctamente.",
    });
  }

  onMiddlewaresError(context: CommandContext, error: string) {
    context.editOrReply({ content: error });
  }
}
