import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db as defaultDb } from "@/db";
import {
  guilds,
  type Guild,
  type GuildRoleRecord,
  type GuildRolesRecord,
  type RoleRateLimitRecord,
} from "@/schemas/guild";
import { roleRateLimiter } from "./rateLimiter";

export type GuildDatabase = NodePgDatabase<Record<string, unknown>>;

/**
 * Mantener una copia vacia garantiza que nunca devolvamos referencias mutables compartidas.
 */
const EMPTY_ROLES: GuildRolesRecord = {};

function cloneRateLimits(
  source: GuildRoleRecord["rateLimits"] | undefined,
): GuildRoleRecord["rateLimits"] {
  return JSON.parse(JSON.stringify(source ?? {})) as GuildRoleRecord["rateLimits"];
}

function cloneRoles(roles: GuildRolesRecord): GuildRolesRecord {
  const output: GuildRolesRecord = {};
  for (const [key, record] of Object.entries(roles)) {
    output[key] = {
      roleId: record.roleId,
      rateLimits: cloneRateLimits(record.rateLimits),
    };
  }
  return output;
}

async function fetchGuildRow(
  guildId: string,
  database: GuildDatabase,
): Promise<Guild | undefined> {
  const [row] = await database
    .select()
    .from(guilds)
    .where(eq(guilds.id, guildId))
    .limit(1);

  return row;
}

async function ensureGuildRow(guildId: string, database: GuildDatabase): Promise<Guild> {
  const existing = await fetchGuildRow(guildId, database);
  if (existing) return existing;

  const [created] = await database
    .insert(guilds)
    .values({ id: guildId })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const fallback = await fetchGuildRow(guildId, database);
  if (!fallback) throw new Error(`Guild ${guildId} could not be loaded after upsert`);
  return fallback;
}

/**
 * Carga la configuracion actual devolviendo siempre una copia nueva.
 */
export async function getGuildRoles(
  guildId: string,
  database: GuildDatabase = defaultDb,
): Promise<GuildRolesRecord> {
  const row = await ensureGuildRow(guildId, database);
  return row.roles ? cloneRoles(row.roles) : cloneRoles(EMPTY_ROLES);
}

/**
 * Persiste la configuracion y entrega el estado recien guardado.
 */
async function saveGuildRoles(
  guildId: string,
  roles: GuildRolesRecord,
  database: GuildDatabase,
): Promise<GuildRolesRecord> {
  await database
    .update(guilds)
    .set({ roles, updatedAt: new Date() })
    .where(eq(guilds.id, guildId));

  return cloneRoles(roles);
}

export interface UpsertRoleInput {
  id: string;
  roleId: string;
  rateLimits?: GuildRoleRecord["rateLimits"];
}

export interface RateLimitHit {
  roleKey: string;
  limit: RoleRateLimitRecord;
  remaining: number;
  resetAt: number;
}

export interface RateLimitViolation {
  roleKey: string;
  limit: RoleRateLimitRecord;
  remaining: number;
  resetAt: number;
}

export type ConsumeLimitResult =
  | { allowed: true; applied: RateLimitHit[] }
  | { allowed: false; violation: RateLimitViolation };

/**
 * Exigir un identificador explicito evita colisiones silenciosas entre servicios.
 */
function normaliseId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) throw new Error("Role id cannot be empty");
  return trimmed;
}

/**
 * Crea o actualiza un rol preservando los limites existentes si no se envian nuevos valores.
 */
export async function upsertRole(
  guildId: string,
  input: UpsertRoleInput,
  database: GuildDatabase = defaultDb,
): Promise<{ id: string; record: GuildRoleRecord }> {
  const roles = await getGuildRoles(guildId, database);
  const id = normaliseId(input.id);
  const current = roles[id];

  const nextRecord: GuildRoleRecord = {
    roleId: input.roleId,
    rateLimits: cloneRateLimits(input.rateLimits ?? current?.rateLimits ?? {}),
  };

  const nextRoles: GuildRolesRecord = { ...roles, [id]: nextRecord };
  await saveGuildRoles(guildId, nextRoles, database);

  return { id, record: nextRecord };
}

/**
 * Eliminar por completo la entrada es mas seguro que dejar valores residuales.
 */
export async function removeRole(
  guildId: string,
  roleKey: string,
  database: GuildDatabase = defaultDb,
): Promise<boolean> {
  const roles = await getGuildRoles(guildId, database);
  if (!roles[roleKey]) return false;

  const nextRoles = { ...roles };
  delete nextRoles[roleKey];
  await saveGuildRoles(guildId, nextRoles, database);
  return true;
}

/**
 * Ajusta el limite de un rol para una accion concreta; `null` significa sin limite.
 */
export async function setRoleRateLimit(
  guildId: string,
  roleKey: string,
  actionKey: string,
  limit: RoleRateLimitRecord | null,
  database: GuildDatabase = defaultDb,
): Promise<GuildRoleRecord> {
  const roles = await getGuildRoles(guildId, database);
  const record = roles[roleKey];
  if (!record) throw new Error(`Role configuration ${roleKey} does not exist`);

  const nextRecord: GuildRoleRecord = {
    ...record,
    rateLimits: { ...record.rateLimits, [actionKey]: limit },
  };

  const nextRoles: GuildRolesRecord = { ...roles, [roleKey]: nextRecord };
  await saveGuildRoles(guildId, nextRoles, database);

  return nextRecord;
}

/**
 * Borrar un limite permite que la accion vuelva a seguir el comportamiento por defecto.
 */
export async function clearRoleRateLimit(
  guildId: string,
  roleKey: string,
  actionKey: string,
  database: GuildDatabase = defaultDb,
): Promise<GuildRoleRecord> {
  const roles = await getGuildRoles(guildId, database);
  const record = roles[roleKey];
  if (!record) throw new Error(`Role configuration ${roleKey} does not exist`);

  if (!(actionKey in record.rateLimits)) return record;

  const nextRateLimits = { ...record.rateLimits };
  delete nextRateLimits[actionKey];

  const nextRecord: GuildRoleRecord = { ...record, rateLimits: nextRateLimits };
  const nextRoles: GuildRolesRecord = { ...roles, [roleKey]: nextRecord };
  await saveGuildRoles(guildId, nextRoles, database);

  return nextRecord;
}

/**
 * Ofrece el limite configurado para integrarlo en validaciones de comandos.
 */
export async function getRoleRateLimit(
  guildId: string,
  roleKey: string,
  actionKey: string,
  database: GuildDatabase = defaultDb,
): Promise<RoleRateLimitRecord | null | undefined> {
  const roles = await getGuildRoles(guildId, database);
  return roles[roleKey]?.rateLimits[actionKey];
}

/**
 * Listar las configuraciones facilita construir paneles de administracion sencillos.
 */
export async function listRoles(
  guildId: string,
  database: GuildDatabase = defaultDb,
): Promise<Array<{ id: string; record: GuildRoleRecord }>> {
  const roles = await getGuildRoles(guildId, database);
  return Object.entries(roles).map(([id, record]) => ({
    id,
    record: { ...record, rateLimits: cloneRateLimits(record.rateLimits) },
  }));
}

export interface ConsumeRoleLimitsOptions {
  guildId: string;
  actionKey: string;
  memberRoleIds: readonly string[];
  database?: GuildDatabase;
}

/**
 * Evalua y consume los limites definidos para los roles que coinciden con el miembro.
 */
export async function consumeRoleRateLimits({
  guildId,
  actionKey,
  memberRoleIds,
  database = defaultDb,
}: ConsumeRoleLimitsOptions): Promise<ConsumeLimitResult> {
  if (!memberRoleIds.length) {
    return { allowed: true, applied: [] };
  }

  const roles = await getGuildRoles(guildId, database);
  const consumed: Array<{ key: string; limit: RoleRateLimitRecord; roleKey: string; result: RateLimitHit }> = [];

  for (const [roleKey, record] of Object.entries(roles)) {
    if (!memberRoleIds.includes(record.roleId)) continue;
    const limit = record.rateLimits[actionKey];
    if (!limit) continue;
    if (limit.uses <= 0 || limit.perSeconds <= 0) continue;

    const bucketKey = `${guildId}:${roleKey}:${actionKey}`;
    const outcome = roleRateLimiter.consume(bucketKey, limit.uses, limit.perSeconds);

    if (!outcome.allowed) {
      for (const entry of consumed) {
        roleRateLimiter.rollback(entry.key);
      }

      return {
        allowed: false,
        violation: {
          roleKey,
          limit,
          remaining: outcome.remaining ?? 0,
          resetAt: outcome.resetAt ?? Date.now(),
        },
      };
    }

    const hit: RateLimitHit = {
      roleKey,
      limit,
      remaining: outcome.remaining ?? 0,
      resetAt: outcome.resetAt ?? Date.now(),
    };

    consumed.push({ key: bucketKey, limit, roleKey, result: hit });
  }

  return {
    allowed: true,
    applied: consumed.map((entry) => entry.result),
  };
}
