import {
  getDB,
  type ChannelId,
  type FlatDataStore,
  type GuildId,
} from "@/modules/flat_api";
import type {
  CoreChannelRecord,
  GuildChannelsRecord,
  ManagedChannelRecord,
} from "@/schemas/guild";
import type { CoreChannelName } from "./constants";

type GuildTask<T> = (
  store: FlatDataStore,
  resolvedGuildId: GuildId,
) => Promise<T>;

async function withGuildStore<T>(
  guildId: string,
  task: GuildTask<T>,
): Promise<T> {
  const store = getDB();
  const resolvedGuildId = guildId as GuildId;
  await store.ensureGuild(resolvedGuildId);
  return await task(store, resolvedGuildId);
}

export async function getGuildChannels(
  guildId: string,
): Promise<GuildChannelsRecord> {
  return await withGuildStore(guildId, (store, resolvedGuildId) =>
    store.getGuildChannels(resolvedGuildId),
  );
}

export async function setCoreChannel(
  guildId: string,
  name: CoreChannelName,
  channelId: string,
): Promise<CoreChannelRecord> {
  return await withGuildStore(guildId, (store, resolvedGuildId) =>
    store.setGuildCoreChannel(resolvedGuildId, name, channelId as ChannelId),
  );
}

export async function addManagedChannel(
  guildId: string,
  label: string,
  channelId: string,
): Promise<ManagedChannelRecord> {
  return await withGuildStore(guildId, (store, resolvedGuildId) =>
    store.addGuildManagedChannel(resolvedGuildId, {
      label,
      channelId: channelId as ChannelId,
    }),
  );
}

export async function removeManagedChannel(
  guildId: string,
  identifier: string,
): Promise<boolean> {
  return await withGuildStore(guildId, (store, resolvedGuildId) =>
    store.removeGuildManagedChannel(resolvedGuildId, identifier),
  );
}

export {
  CORE_CHANNEL_DEFINITIONS,
  CORE_CHANNEL_LABELS,
  type CoreChannelName,
} from "./constants";
