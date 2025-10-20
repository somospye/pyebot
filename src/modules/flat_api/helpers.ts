import { randomUUID } from "node:crypto";

import {
  CORE_CHANNEL_DEFINITIONS,
  type CoreChannelName,
} from "@/modules/guild-channels/constants";
import type {
  CoreChannelRecord,
  GuildChannelsRecord,
  GuildRoleRecord,
  GuildRolesRecord,
  ManagedChannelRecord,
} from "@/schemas/guild";

import type {
  GuildId,
  GuildInit,
  GuildInsert,
  GuildRow,
  ManagedRoleSnapshot,
  RoleId,
  UserId,
  UserInit,
  UserInsert,
  UserRow,
} from "./types";

function describeCause(cause: unknown): string {
  if (cause instanceof Error) return cause.message || cause.name;
  if (typeof cause === "string") return cause;
  if (cause === undefined) return "undefined";
  if (cause === null) return "null";
  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
}

/**
 * Create an {@link Error} with a detailed message describing the failure.
 */
export function formatError(message: string, cause: unknown): Error {
  const detail = describeCause(cause);
  const composed = detail ? `${message}: ${detail}` : message;
  return new Error(composed);
}

/**
 * Execute an async operation, throwing a formatted error when it fails.
 */
export async function runWithError<T>(
  operation: () => Promise<T>,
  message: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw formatError(message, error);
  }
}

type StructuredCloneFn = <T>(value: T) => T;
const nativeStructuredClone =
  typeof (globalThis as { structuredClone?: StructuredCloneFn }).structuredClone ===
  "function"
    ? (globalThis as { structuredClone: StructuredCloneFn }).structuredClone
    : undefined;

/**
 * Create a deep copy of the provided value so callers can mutate it safely.
 *
 * The helper favours the native `structuredClone` implementation for correctness and
 * falls back to a JSON-like clone that covers the persisted shapes used by the data layer.
 */
export function deepClone<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (nativeStructuredClone) {
    try {
      return nativeStructuredClone(value);
    } catch {
      // structuredClone rejects some data (e.g. functions). Fall back in that case.
    }
  }
  return legacyClone(value);
}

/**
 * Fallback deep clone implementation for JSON-like data when `structuredClone` is unavailable.
 *
 * @param value Value to clone.
 * @returns Deep copy of the provided value.
 */
function legacyClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => legacyClone(entry)) as unknown as T;
  }
  if (value instanceof Date) {
    return new Date(value.getTime()) as unknown as T;
  }
  if (isPlainObject(value)) {
    const clone: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      clone[key] = legacyClone(entry);
    }
    return clone as unknown as T;
  }
  return value;
}

/**
 * Determine whether a value is a plain object (object literal or null prototype).
 *
 * @param value Value to inspect.
 * @returns `true` when the value can be safely cloned via object spread.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Build the canonical payload persisted under the `guilds.channels` JSON column.
 *
 * @returns Default guild channels record including all core definitions.
 */
export function createDefaultChannelsRecord(): GuildChannelsRecord {
  const coreEntries = CORE_CHANNEL_DEFINITIONS.map(
    (definition): [CoreChannelName, CoreChannelRecord] => [
      definition.name,
      {
        name: definition.name,
        label: definition.label,
        channelId: definition.defaultChannelId ?? "",
      },
    ],
  );

  return {
    core: Object.fromEntries(coreEntries) as Record<
      CoreChannelName,
      CoreChannelRecord
    >,
    managed: {},
    ticketMessageId: null,
  };
}

/**
 * Ensure a guild channels record includes default core channel entries and safe copies.
 *
 * The result can be mutated freely by higher-level code without risking shared references.
 */
export function withChannelDefaults(
  channels: GuildChannelsRecord | null | undefined,
): GuildChannelsRecord {
  const base = createDefaultChannelsRecord();
  if (!channels) return base;

  const normalisedCore = Object.fromEntries(
    Object.entries(channels.core ?? {}).map(([name, record]) => {
      const channelName = name as CoreChannelName;
      const template = base.core[channelName];
      return [
        channelName,
        {
          name: channelName,
          label: record?.label ?? template?.label ?? channelName,
          channelId: record?.channelId ?? template?.channelId ?? "",
        },
      ];
    }),
  ) as Record<CoreChannelName, CoreChannelRecord>;

  return {
    core: deepClone({
      ...base.core,
      ...normalisedCore,
    }) as Record<CoreChannelName, CoreChannelRecord>,
    managed: deepClone(channels.managed ?? {}),
    ticketMessageId:
      channels.ticketMessageId ?? base.ticketMessageId ?? null,
  };
}

/**
 * Produce a brand-new role record with defaults used when provisioning missing entries.
 *
 * @param key Logical role identifier.
 * @returns Empty role record populated with safe defaults.
 */
export function createEmptyRoleRecord(key: string): GuildRoleRecord {
  return {
    label: key,
    discordRoleId: null,
    limits: {},
    reach: {},
    updatedBy: null,
    updatedAt: null,
  };
}

/**
 * Build the payload used when inserting a new guild row into the database.
 *
 * @param id Guild identifier.
 * @param init Optional initial guild data.
 * @returns Insert payload with defaults applied.
 */
export function buildGuildInsert(id: GuildId, init: GuildInit): GuildInsert {
  const channels = deepClone(withChannelDefaults(init.channels));
  const roles = deepClone(init.roles ?? {});

  return {
    id,
    channels,
    roles,
    createdAt: init.createdAt ?? new Date(),
    updatedAt: init.updatedAt ?? new Date(),
  };
}

/**
 * Build the payload used when inserting a new user row into the database.
 *
 * @param id User identifier.
 * @param init Optional initial user data.
 * @returns Insert payload with defaults applied.
 */
export function buildUserInsert(id: UserId, init: UserInit): UserInsert {
  return {
    id,
    bank: init.bank ?? 0,
    cash: init.cash ?? 0,
    warns: deepClone(init.warns ?? []),
  };
}

/**
 * Remove undefined keys from an update object so we never overwrite columns with null.
 *
 * @param changes User-supplied update payload.
 * @returns Update payload with all undefined properties removed.
 */
export function sanitiseUpdate<T extends Record<string, unknown>>(
  changes: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/**
 * Normalise an action identifier before persisting it to the database.
 *
 * @param action Raw action identifier supplied by clients.
 * @returns Lower-cased, trimmed action identifier.
 */
export function normaliseActionName(action: string): string {
  return action.trim().toLowerCase();
}

/**
 * Convert a roles record into presentation-friendly snapshots.
 *
 * @param record Raw stored role map.
 * @returns Array of snapshots suitable for the public API.
 */
export function toManagedRoleSnapshots(
  record: GuildRolesRecord,
): ManagedRoleSnapshot[] {
  return Object.entries(record).map(([key, role]) =>
    toManagedRoleSnapshot(key, role),
  );
}

/**
 * Convert a single stored role entry into a snapshot with branded identifiers.
 *
 * @param key Logical role key.
 * @param record Stored role configuration.
 * @returns Snapshot representation with branded identifiers.
 */
export function toManagedRoleSnapshot(
  key: string,
  record: GuildRoleRecord,
): ManagedRoleSnapshot {
  return {
    key,
    label: record.label ?? key,
    discordRoleId: record.discordRoleId
      ? (record.discordRoleId as RoleId)
      : null,
    overrides: { ...(record.reach ?? {}) },
    limits: { ...(record.limits ?? {}) },
    updatedBy: record.updatedBy ?? null,
    updatedAt: record.updatedAt ?? null,
  };
}

/**
 * Derive a managed channel identifier based on its label, ensuring uniqueness by appending counters.
 *
 * @param label Desired managed channel label.
 * @param existing Registry of existing managed channels.
 * @returns Unique managed channel identifier.
 */
export function generateManagedChannelId(
  label: string,
  existing: Record<string, ManagedChannelRecord>,
): string {
  const slug = slugify(label);
  const base = slug || `channel-${randomUUID().slice(0, 8)}`;
  if (!existing[base]) return base;

  let attempt = 1;
  let candidate = `${base}-${attempt}`;
  while (existing[candidate]) {
    attempt += 1;
    candidate = `${base}-${attempt}`;
    if (attempt > 1_000) {
      candidate = `${base}-${randomUUID().slice(0, 6)}`;
      if (!existing[candidate]) break;
    }
  }
  return candidate;
}

/**
 * Try to resolve a managed channel key by id or by label.
 *
 * @param managed Managed channel registry.
 * @param identifier Managed channel id or label.
 * @returns Resolved key or `null` if not found.
 */
export function resolveManagedKey(
  managed: Record<string, ManagedChannelRecord>,
  identifier: string,
): string | null {
  if (managed[identifier]) return identifier;
  const entry = Object.entries(managed).find(
    ([, record]) => record.label === identifier,
  );
  return entry ? entry[0] : null;
}

/**
 * Transform a persisted guild row into its cloned counterpart.
 *
 * @param row Row fetched from the database.
 * @returns Deep cloned and normalised guild row.
 */
export function normaliseGuildRow(row: GuildRow): GuildRow {
  return {
    ...row,
    channels: deepClone(withChannelDefaults(row.channels)),
    roles: deepClone(row.roles ?? {}),
  };
}

/**
 * Transform a persisted user row into a cloned counterpart.
 *
 * @param row Row fetched from the database.
 * @returns Deep cloned and normalised user row.
 */
export function normaliseUserRow(row: UserRow): UserRow {
  return {
    ...row,
    warns: deepClone(row.warns ?? []),
  };
}

/**
 * Basic slug generation compatible with the previous data layer.
 *
 * @param value Raw label to slugify.
 * @returns Slug string safe for identifiers.
 */
function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
