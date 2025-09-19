import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { db as defaultDb } from "@/db";
import { guilds, type Guild, type GuildChannelsRecord } from "@/schemas/guild";

export type GuildDatabase = NodePgDatabase<Record<string, unknown>>;

/** Adaptador de acceso a datos para la tabla `guilds`. */
export class GuildChannelsRepository {
  constructor(private readonly database: GuildDatabase = defaultDb) {}

  async getGuild(guildId: string): Promise<Guild | undefined> {
    const result = await this.database
      .select()
      .from(guilds)
      .where(eq(guilds.id, guildId))
      .limit(1);

    return result[0];
  }

  async insert(guildId: string, channels: GuildChannelsRecord): Promise<Guild> {
    const [row] = await this.database
      .insert(guilds)
      .values({ id: guildId, channels })
      .returning();

    return row;
  }

  async updateChannels(
    guildId: string,
    channels: GuildChannelsRecord,
  ): Promise<void> {
    await this.database
      .update(guilds)
      .set({ channels, updatedAt: new Date() })
      .where(eq(guilds.id, guildId));
  }
}
