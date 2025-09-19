import { CORE_CHANNEL_DEFINITIONS, type CoreChannelName } from "./constants";
import type {
  CoreChannelRecord,
  GuildChannelsRecord,
  ManagedChannelRecord,
} from "@/schemas/guild";
import { GuildChannelsRepository, type GuildDatabase } from "./repository";

/** Construye el mapa base usando las definiciones fijas para poblar nuevos registros. */
function createDefaultCore(): Record<CoreChannelName, CoreChannelRecord> {
  return CORE_CHANNEL_DEFINITIONS.reduce(
    (accumulator, definition) => {
      accumulator[definition.name] = {
        name: definition.name,
        label: definition.label,
        channelId: definition.defaultChannelId,
      };
      return accumulator;
    },
    {} as Record<CoreChannelName, CoreChannelRecord>,
  );
}

/** Duplica el estado antes de escribir en DB y evitar efectos secundarios. */
function cloneState(state: GuildChannelsRecord): GuildChannelsRecord {
  return {
    core: Object.fromEntries(
      Object.entries(state.core).map(([key, value]) => [key, { ...value }]),
    ) as Record<CoreChannelName, CoreChannelRecord>,
    managed: Object.fromEntries(
      Object.entries(state.managed).map(([key, value]) => [key, { ...value }]),
    ),
  };
}

/** Normaliza etiquetas libres para poder versionarlas como identificadores. */
function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Asegura un identificador unico que conecte la etiqueta humana con la fila persistida. */
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

/** Orquesta la sincronizacion entre la configuracion persistida y las reglas del bot. */
export class GuildChannelService {
  constructor(private readonly repository: GuildChannelsRepository) {}

  static from(database?: GuildDatabase): GuildChannelService {
    return new GuildChannelService(new GuildChannelsRepository(database));
  }

  async ensureGuild(guildId: string): Promise<GuildChannelsRecord> {
    const existing = await this.repository.getGuild(guildId);

    if (!existing) {
      const defaults: GuildChannelsRecord = {
        core: createDefaultCore(),
        managed: {},
      };
      await this.repository.insert(guildId, defaults);
      return defaults;
    }

    const normalized = this.normalize(existing.channels);

    if (normalized.changed) {
      await this.repository.updateChannels(guildId, normalized.state);
    }

    return normalized.state;
  }

  async list(guildId: string): Promise<GuildChannelsRecord> {
    return await this.ensureGuild(guildId);
  }

  async setCoreChannel(
    guildId: string,
    name: CoreChannelName,
    channelId: string,
  ): Promise<CoreChannelRecord> {
    const state = await this.ensureGuild(guildId);
    const current = state.core[name];

    if (current.channelId === channelId) {
      return current;
    }

    const next = cloneState(state);
    next.core[name] = { ...current, channelId };

    await this.repository.updateChannels(guildId, next);
    return next.core[name];
  }

  async addManagedChannel(
    guildId: string,
    label: string,
    channelId: string,
  ): Promise<ManagedChannelRecord> {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      throw new Error("El label del canal no puede quedar vacio.");
    }

    const state = await this.ensureGuild(guildId);
    const next = cloneState(state);
    const identifier = generateManagedId(trimmedLabel, next.managed);

    const record: ManagedChannelRecord = {
      id: identifier,
      label: trimmedLabel,
      channelId,
    };

    next.managed[identifier] = record;
    await this.repository.updateChannels(guildId, next);
    return record;
  }

  async removeManagedChannel(
    guildId: string,
    identifier: string,
  ): Promise<boolean> {
    const state = await this.ensureGuild(guildId);

    if (!state.managed[identifier]) {
      return false;
    }

    const next = cloneState(state);
    delete next.managed[identifier];
    await this.repository.updateChannels(guildId, next);
    return true;
  }

  /** Realinea la informacion guardada con el catalogo de canales core vigente. */
  private normalize(channels?: GuildChannelsRecord | null): {
    state: GuildChannelsRecord;
    changed: boolean;
  } {
    const baseline: GuildChannelsRecord = channels
      ? {
          core: channels.core ?? ({} as Record<CoreChannelName, CoreChannelRecord>),
          managed: channels.managed ?? {},
        }
      : {
          core: {} as Record<CoreChannelName, CoreChannelRecord>,
          managed: {},
        };

    const normalizedCore: Record<CoreChannelName, CoreChannelRecord> = {
      ...baseline.core,
    } as Record<CoreChannelName, CoreChannelRecord>;
    let changed = false;

    for (const definition of CORE_CHANNEL_DEFINITIONS) {
      const current = baseline.core?.[definition.name];
      const ensured: CoreChannelRecord = {
        name: definition.name,
        label: definition.label,
        channelId: current?.channelId || definition.defaultChannelId,
      };

      if (
        !current ||
        current.channelId !== ensured.channelId ||
        current.label !== ensured.label ||
        current.name !== ensured.name
      ) {
        changed = true;
      }

      normalizedCore[definition.name] = ensured;
    }

    const normalizedManaged = baseline.managed ?? {};

    return {
      state: {
        core: normalizedCore,
        managed: normalizedManaged,
      },
      changed,
    };
  }
}


