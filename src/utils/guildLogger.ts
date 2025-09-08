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

  async messageLog(options: EmbedOptions) {
    const embed = this.buildEmbed(options);
    this.client.messages.write(CHANNELS_ID.messageLogs, { embeds: [embed] });
  }

  async voiceLog(options: EmbedOptions) {
    const embed = this.buildEmbed(options);
    this.client.messages.write(CHANNELS_ID.voiceLogs, { embeds: [embed] });
  }

  async ticketLog(options: EmbedOptions) {
    const embed = this.buildEmbed(options);
    this.client.messages.write(CHANNELS_ID.ticketLogs, { embeds: [embed] });
  }

  async pointLog(options: EmbedOptions) {
    const embed = this.buildEmbed(options);
    this.client.messages.write(CHANNELS_ID.pointsLog, { embeds: [embed] });
  }

  async generalLog(options: EmbedOptions) {
    const embed = this.buildEmbed(options);
    this.client.messages.write(CHANNELS_ID.generalLogs, { embeds: [embed] });
  }

  async banSanctionLog(options: EmbedOptions) {
    const embed = this.buildEmbed(options);
    this.client.messages.write(CHANNELS_ID.banSanctions, { embeds: [embed] });
  }
}
