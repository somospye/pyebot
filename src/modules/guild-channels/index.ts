// migrated to use the flat repo at "@/modules/repo"
import * as repo from "@/modules/repo";
import type {
  CoreChannelRecord,
  GuildChannelsRecord,
  ManagedChannelRecord,
} from "@/schemas/guild";
import type { CoreChannelName } from "./constants";

/** Get the full channels JSON for a guild. */
export async function getGuildChannels(guildId: string): Promise<GuildChannelsRecord> {
  await repo.ensureGuild(guildId);
  // repo.readChannels returns the channels JSONB blob
  return (await repo.readChannels(guildId)) as GuildChannelsRecord;
}

/** Set a core channel and return that single core entry. */
export async function setCoreChannel(
  guildId: string,
  name: CoreChannelName,
  channelId: string,
): Promise<CoreChannelRecord> {
  await repo.ensureGuild(guildId);
  await repo.setCoreChannel(guildId, name, channelId);
  // repo.setCoreChannel returns the whole channels map; we re-read the single entry
  return (await repo.getCoreChannel(guildId, name)) as CoreChannelRecord;
}

/** Add a managed channel and return the created record. */
export async function addManagedChannel(
  guildId: string,
  label: string,
  channelId: string,
): Promise<ManagedChannelRecord> {
  await repo.ensureGuild(guildId);
  // Perform the write
  await repo.addManagedChannel(guildId, { label, channelId });
  // Find the created entry by label+channelId
  const channels = (await repo.readChannels(guildId)) as GuildChannelsRecord;
  const created =
    Object.values(channels?.managed ?? {}).find(
      (m: any) => m?.label === label && m?.channelId === channelId,
    ) ?? null;

  if (!created) {
    throw new Error("Failed to find created managed channel after insert.");
  }
  return created as ManagedChannelRecord;
}

/** Remove by key or label; returns true only if something actually got removed. */
export async function removeManagedChannel(
  guildId: string,
  identifier: string,
): Promise<boolean> {
  await repo.ensureGuild(guildId);
  const before = (await repo.readChannels(guildId)) as GuildChannelsRecord;
  const existed =
    !!before?.managed?.[identifier] ||
    Object.values(before?.managed ?? {}).some((m: any) => m?.label === identifier);

  if (!existed) return false;

  await repo.removeManagedChannel(guildId, identifier);
  return true;
}

// passthrough exports
export {
  CORE_CHANNEL_DEFINITIONS,
  CORE_CHANNEL_LABELS,
  type CoreChannelName,
} from "./constants";
