import { ensureGuild, updateGuild, type GuildDatabase } from "@/modules/guilds/store";
import { CORE_CHANNEL_DEFINITIONS, type CoreChannelName } from "./constants";
import type {
  CoreChannelRecord,
  GuildChannelsRecord,
  ManagedChannelRecord,
} from "@/schemas/guild";

const EMPTY_CHANNELS: GuildChannelsRecord = {
  core: {} as Record<CoreChannelName, CoreChannelRecord>,
  managed: {},
};

function cloneChannels(source?: GuildChannelsRecord | null): GuildChannelsRecord {
  if (!source) {
    return {
      core: { ...EMPTY_CHANNELS.core },
      managed: {},
    };
  }

  const core = Object.fromEntries(
    Object.entries(source.core ?? {}).map(([key, value]) => [
      key,
      { ...value },
    ]),
  ) as Record<CoreChannelName, CoreChannelRecord>;

  const managed = Object.fromEntries(
    Object.entries(source.managed ?? {}).map(([key, value]) => [
      key,
      { ...value },
    ]),
  );

  return { core, managed };
}

function normaliseChannels(
  channels?: GuildChannelsRecord | null,
): { state: GuildChannelsRecord; changed: boolean } {
  const baseline = cloneChannels(channels ?? EMPTY_CHANNELS);
  let changed = !channels;

  const core = baseline.core as Record<CoreChannelName, CoreChannelRecord>;

  for (const definition of CORE_CHANNEL_DEFINITIONS) {
    const current = baseline.core?.[definition.name];
    const ensured: CoreChannelRecord = {
      name: definition.name,
      label: definition.label,
      channelId: current?.channelId ?? definition.defaultChannelId,
    };

    if (
      !current ||
      current.name !== ensured.name ||
      current.label !== ensured.label ||
      current.channelId !== ensured.channelId
    ) {
      changed = true;
    }

    core[definition.name] = ensured;
  }

  return {
    state: {
      core,
      managed: baseline.managed,
    },
    changed,
  };
}

async function writeChannels(
  guildId: string,
  channels: GuildChannelsRecord,
  database?: GuildDatabase,
): Promise<GuildChannelsRecord> {
  await updateGuild(guildId, { channels }, database);
  return cloneChannels(channels);
}

async function ensureChannels(
  guildId: string,
  database?: GuildDatabase,
): Promise<GuildChannelsRecord> {
  const guild = await ensureGuild(guildId, database);
  const normalised = normaliseChannels(guild.channels);

  if (normalised.changed) {
    return await writeChannels(guildId, normalised.state, database);
  }

  return cloneChannels(normalised.state);
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateManagedId(
  label: string,
  existing: Record<string, ManagedChannelRecord>,
): string {
  const base = slugify(label) || "channel";
  if (!existing[base]) return base;

  let counter = 2;
  let candidate = `${base}-${counter}`;
  while (existing[candidate]) {
    counter += 1;
    candidate = `${base}-${counter}`;
  }

  return candidate;
}

export async function getGuildChannels(
  guildId: string,
  database?: GuildDatabase,
): Promise<GuildChannelsRecord> {
  return await ensureChannels(guildId, database);
}

export async function setCoreChannel(
  guildId: string,
  name: CoreChannelName,
  channelId: string,
  database?: GuildDatabase,
): Promise<CoreChannelRecord> {
  const channels = await ensureChannels(guildId, database);
  const current = channels.core[name];

  if (current.channelId === channelId) {
    return current;
  }

  const next = cloneChannels(channels);
  next.core[name] = { ...current, channelId };

  const saved = await writeChannels(guildId, next, database);
  return saved.core[name];
}

export async function addManagedChannel(
  guildId: string,
  label: string,
  channelId: string,
  database?: GuildDatabase,
): Promise<ManagedChannelRecord> {
  const trimmedLabel = label.trim();
  if (!trimmedLabel) {
    throw new Error("El label del canal no puede quedar vacio.");
  }

  const channels = await ensureChannels(guildId, database);
  const next = cloneChannels(channels);
  const identifier = generateManagedId(trimmedLabel, next.managed);

  const record: ManagedChannelRecord = {
    id: identifier,
    label: trimmedLabel,
    channelId,
  };

  next.managed[identifier] = record;
  const saved = await writeChannels(guildId, next, database);
  return saved.managed[identifier];
}

export async function removeManagedChannel(
  guildId: string,
  identifier: string,
  database?: GuildDatabase,
): Promise<boolean> {
  const channels = await ensureChannels(guildId, database);

  if (!channels.managed[identifier]) {
    return false;
  }

  const next = cloneChannels(channels);
  delete next.managed[identifier];

  await writeChannels(guildId, next, database);
  return true;
}

export { CORE_CHANNEL_DEFINITIONS, type CoreChannelName } from "./constants";
export { CORE_CHANNEL_LABELS } from "./constants";
