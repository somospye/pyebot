import { Embed, type UsingClient } from "seyfert";
import type { ColorResolvable } from "seyfert/lib/common";
import type { APIEmbedField } from "seyfert/lib/types";
import { CHANNELS_ID } from "@/constants/guild";

type EmbedOptions = {
  title?: string;
  description?: string;
  color?: ColorResolvable;
  fields?: APIEmbedField[];
  footer?: { text: string; iconUrl?: string };
  thumbnail?: string;
  image?: string;
  url?: string;
};

export class GuildLogger {
  private client!: UsingClient;

  async init(client: UsingClient) {
    this.client = client;
    return this;
  }

  private buildEmbed(options: EmbedOptions): Embed {
    const embed = new Embed()
      .setTimestamp()
      .setColor(options.color ?? "Blurple");

    if (options.title) embed.setTitle(options.title);
    if (options.description) embed.setDescription(options.description);
    if (options.fields) embed.setFields(options.fields);
    if (options.footer) embed.setFooter(options.footer);
    if (options.thumbnail) embed.setThumbnail(options.thumbnail);
    if (options.image) embed.setImage(options.image);
    if (options.url) embed.setURL(options.url);

    return embed;
  }

  private async sendLog(
    channelId: string,
    options: EmbedOptions,
  ): Promise<void> {
    const embed = this.buildEmbed(options);
    await this.client.messages.write(channelId, { embeds: [embed] });
  }

  async messageLog(options: EmbedOptions) {
    return this.sendLog(CHANNELS_ID.messageLogs, options);
  }

  async voiceLog(options: EmbedOptions) {
    return this.sendLog(CHANNELS_ID.voiceLogs, options);
  }

  async ticketLog(options: EmbedOptions) {
    return this.sendLog(CHANNELS_ID.ticketLogs, options);
  }

  async pointLog(options: EmbedOptions) {
    return this.sendLog(CHANNELS_ID.pointsLog, options);
  }

  async generalLog(options: EmbedOptions) {
    return this.sendLog(CHANNELS_ID.generalLogs, options);
  }

  async banSanctionLog(options: EmbedOptions) {
    return this.sendLog(CHANNELS_ID.banSanctions, options);
  }
}
