import { get_data_api, toChannelId, toGuildId } from "@/modules/flat_api";
import type {
  CoreChannelRecord,
  GuildChannelsRecord,
  ManagedChannelRecord,
} from "@/schemas/guild";
import type { CoreChannelName } from "./constants";

export async function getGuildChannels(
  guildId: string,
): Promise<GuildChannelsRecord> {
  const data = get_data_api();
  const resolvedGuildId = toGuildId(guildId);
  await data.ensureGuild(resolvedGuildId);
  return await data.getGuildChannels(resolvedGuildId);
}

export async function setCoreChannel(
  guildId: string,
  name: CoreChannelName,
  channelId: string,
): Promise<CoreChannelRecord> {
  const data = get_data_api();
  const resolvedGuildId = toGuildId(guildId);
  await data.ensureGuild(resolvedGuildId);
  return await data.setGuildCoreChannel(
    resolvedGuildId,
    name,
    toChannelId(channelId),
  );
}

export async function addManagedChannel(
  guildId: string,
  label: string,
  channelId: string,
): Promise<ManagedChannelRecord> {
  const data = get_data_api();
  const resolvedGuildId = toGuildId(guildId);
  await data.ensureGuild(resolvedGuildId);
  return await data.addGuildManagedChannel(resolvedGuildId, {
    label,
    channelId: toChannelId(channelId),
  });
}

export async function removeManagedChannel(
  guildId: string,
  identifier: string,
): Promise<boolean> {
  const data = get_data_api();
  const resolvedGuildId = toGuildId(guildId);
  await data.ensureGuild(resolvedGuildId);
  return await data.removeGuildManagedChannel(resolvedGuildId, identifier);
}

export {
  CORE_CHANNEL_DEFINITIONS,
  CORE_CHANNEL_LABELS,
  type CoreChannelName,
} from "./constants";
