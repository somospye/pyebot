import { CHANNELS_ID } from "@/constants/guild";
import type { UsingClient, Embed } from "seyfert";

/*
it can be improved so that the generation of embeds is dynamic and does not depend on 
building it externally, but for now i'm not going to do that :)
*/

export class GuildLogger {
  private client!: UsingClient;

  async init(client: UsingClient) {
    this.client = client;
    return this;
  }

  async messageLog(embed: Embed) {
    this.client.messages.write(CHANNELS_ID.messageLogs, { embeds: [embed] });
  }

  async voiceLog(embed: Embed) {
    this.client.messages.write(CHANNELS_ID.voiceLogs, { embeds: [embed] });
  }

  async ticketLog(embed: Embed) {
    this.client.messages.write(CHANNELS_ID.ticketLogs, { embeds: [embed] });
  }

  async pointLog(embed: Embed) {
    this.client.messages.write(CHANNELS_ID.pointsLog, { embeds: [embed] });
  }

  async generalLog(embed: Embed) {
    this.client.messages.write(CHANNELS_ID.generalLogs, { embeds: [embed] });
  }
}
