import type { GuildId } from "@/modules/flat_api";

const DEFAULT_GUILD_ONLY_MESSAGE =
  "[!] Este comando solo puede ejecutarse dentro de un servidor.";

type GuildAwareContext = {
  guildId?: string | null;
  write(payload: { content: string }): Promise<unknown>;
};

/**
 * Ensure the current command context runs inside a guild.
 * Sends a standard warning message when invoked from DMs.
 *
 * @param ctx Command or component context with a `guildId`.
 * @param message Override for the warning text.
 * @returns Resolved guild identifier or null when unavailable.
 */
export async function requireGuildId<T extends GuildAwareContext>(
  ctx: T,
  message = DEFAULT_GUILD_ONLY_MESSAGE,
): Promise<GuildId | null> {
  if (!ctx.guildId) {
    await ctx.write({ content: message });
    return null;
  }
  return ctx.guildId as GuildId;
}

export const GUILD_ONLY_MESSAGE = DEFAULT_GUILD_ONLY_MESSAGE;

