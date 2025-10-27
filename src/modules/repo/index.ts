// Single-file, flat module. No factories, no classes. Just dumb functions.
// Assumes a shared Drizzle instance exported from "@/db".
// If you ever need to test, you can still swap the module via jest/ts-node mocks.

import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { users } from "@/schemas/user";
import { guilds } from "@/schemas/guild";

// Tiny helper for JSON cloning at API edges only
const clone = <T>(v: T): T => (typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

type UserPatch = Partial<{
    bank: number;
    cash: number;
    warns: any[];
    openTickets: string[];
}>;

// ----------------------------- USERS -----------------------------
export async function getUser(id: string) {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
}

export async function userExists(id: string) {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    return !!row;
}

export async function ensureUser(id: string, init: UserPatch = {}) {
    const [inserted] = await db.insert(users).values({ id, ...init }).onConflictDoNothing().returning();
    if (inserted) return inserted;
    const existing = await getUser(id);
    if (!existing) throw new Error(`ensureUser failed (id=${id})`);
    return existing;
}

export async function upsertUser(id: string, patch: UserPatch = {}) {
    const [row] = await db.insert(users).values({ id, ...patch }).onConflictDoUpdate({ target: users.id, set: { ...patch } }).returning();
    return row!;
}

export async function updateUser(id: string, patch: UserPatch) {
    if (!patch || Object.keys(patch).length === 0) return (await getUser(id)) ?? null;
    const [row] = await db.update(users).set({ ...patch }).where(eq(users.id, id)).returning();
    return row ?? null;
}

export async function removeUser(id: string) {
    const res = await db.delete(users).where(eq(users.id, id));
    return (res.rowCount ?? 0) > 0;
}

export async function bumpBalance(id: string, delta: { bank?: number; cash?: number }) {
    await ensureUser(id);
    const updates: any = {};
    if (typeof delta.bank === "number") updates.bank = sql`${users.bank} + ${delta.bank}`;
    if (typeof delta.cash === "number") updates.cash = sql`${users.cash} + ${delta.cash}`;
    if (Object.keys(updates).length === 0) return await getUser(id);
    const [row] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return row ?? null;
}

export async function listWarns(id: string) {
    const u = await ensureUser(id);
    return Array.isArray(u.warns) ? clone(u.warns) : [];
}

export async function setWarns(id: string, warns: any[]) {
    await ensureUser(id);
    const [row] = await db.update(users).set({ warns }).where(eq(users.id, id)).returning();
    return row!.warns ?? [];
}

export async function addWarn(id: string, warn: any) {
    const current = await listWarns(id);
    current.push(warn);
    const [row] = await db.update(users).set({ warns: current }).where(eq(users.id, id)).returning();
    return row!.warns ?? [];
}

export async function removeWarn(id: string, warnId: string) {
    const current = await listWarns(id);
    const next = current.filter((w: any) => w?.warn_id !== warnId);
    const [row] = await db.update(users).set({ warns: next }).where(eq(users.id, id)).returning();
    return row!.warns ?? [];
}

export async function clearWarns(id: string) {
    const [row] = await db.update(users).set({ warns: [] }).where(eq(users.id, id)).returning();
    return row!.warns ?? [];
}

export async function listOpenTickets(id: string) {
    const user = await ensureUser(id);
    return Array.isArray(user.openTickets) ? clone(user.openTickets) : [];
}

export async function setOpenTickets(id: string, tickets: string[]) {
    await ensureUser(id);
    const unique = Array.from(new Set(tickets.filter((value): value is string => typeof value === "string" && value.length > 0)));
    const [row] = await db
        .update(users)
        .set({ openTickets: unique })
        .where(eq(users.id, id))
        .returning({ openTickets: users.openTickets });
    return Array.isArray(row?.openTickets) ? clone(row.openTickets) : [];
}

export async function addOpenTicket(id: string, channelId: string) {
    const current = await listOpenTickets(id);
    if (current.includes(channelId)) return current;
    current.push(channelId);
    return setOpenTickets(id, current);
}

export async function removeOpenTicket(id: string, channelId: string) {
    const current = await listOpenTickets(id);
    return setOpenTickets(
        id,
        current.filter((entry) => entry !== channelId),
    );
}

export async function removeOpenTicketByChannel(channelId: string) {
    if (!channelId) return;
    const rows = await db.select({ id: users.id, openTickets: users.openTickets }).from(users);
    const owners = rows
        .filter(
            (row) =>
                Array.isArray(row.openTickets) &&
                row.openTickets.some((entry) => entry === channelId),
        )
        .map((row) => row.id);

    await Promise.all(
        owners.map((ownerId) => removeOpenTicket(ownerId, channelId).catch((error) => {
            console.error("[repo] removeOpenTicket failed", { ownerId, channelId, error });
        })),
    );
}

// ----------------------------- GUILDS -----------------------------
export async function getGuild(id: string) {
    const [row] = await db.select().from(guilds).where(eq(guilds.id, id)).limit(1);
    return row ?? null;
}

export async function ensureGuild(id: string) {
    const [inserted] = await db.insert(guilds).values({ id }).onConflictDoNothing().returning();
    if (inserted) return inserted;
    const existing = await getGuild(id);
    if (!existing) throw new Error(`ensureGuild failed (id=${id})`);
    return existing;
}

export async function deleteGuild(id: string) {
    const res = await db.delete(guilds).where(eq(guilds.id, id));
    return (res.rowCount ?? 0) > 0;
}

// JSON accessors. Keep shapes flexible.
export async function readChannels(id: string) {
    const g = await ensureGuild(id);
    return clone(g.channels ?? {});
}

export async function writeChannels(id: string, mutate: (current: any) => any) {
    const current = await readChannels(id);
    const next = clone(mutate(current));
    const [row] = await db.update(guilds).set({ channels: next, updatedAt: new Date() }).where(eq(guilds.id, id)).returning();
    return row!.channels;
}

export async function readRoles(id: string) {
    const g = await ensureGuild(id);
    return clone(g.roles ?? {});
}

export async function writeRoles(id: string, mutate: (current: any) => any) {
    const current = await readRoles(id);
    const next = clone(mutate(current));
    const [row] = await db.update(guilds).set({ roles: next, updatedAt: new Date() }).where(eq(guilds.id, id)).returning();
    return row!.roles;
}

// ----------------------------- TICKETS -----------------------------
export async function getPendingTickets(guildId: string) {
    const g = await ensureGuild(guildId);
    return Array.isArray(g.pendingTickets) ? clone(g.pendingTickets) : [];
}

export async function setPendingTickets(guildId: string, update: (tickets: string[]) => string[]) {
    const guild = await ensureGuild(guildId);
    const current = Array.isArray(guild.pendingTickets) ? clone(guild.pendingTickets) : [];
    const next = update(clone(current));
    const sanitized = Array.isArray(next) ? next.filter((id): id is string => typeof id === "string") : [];
    const unique = Array.from(new Set(sanitized));
    const [row] = await db
        .update(guilds)
        .set({ pendingTickets: unique, updatedAt: new Date() })
        .where(eq(guilds.id, guildId))
        .returning({ pendingTickets: guilds.pendingTickets });
    return clone(row?.pendingTickets ?? []);
}

// Convenience wrappers (optional)
export async function setCoreChannel(id: string, name: string, channelId: string) {
    return writeChannels(id, (c: any) => {
        const next = clone(c);
        next.core = next.core ?? {};
        next.core[name] = { ...(next.core[name] ?? { name, label: name, channelId: null }), channelId };
        return next;
    });
}

export async function getCoreChannel(id: string, name: string) {
    const c = await readChannels(id);
    const core = c?.core;
    if (!core) return null;
    return core[name as keyof typeof core] ?? null;
}

export async function setTicketCategory(id: string, categoryId: string | null) {
    return writeChannels(id, (c: any) => ({ ...c, ticketCategoryId: categoryId }));
}

export async function setTicketMessage(id: string, messageId: string | null) {
    return writeChannels(id, (c: any) => ({ ...c, ticketMessageId: messageId }));
}

export async function listManagedChannels(id: string) {
    const c = await readChannels(id);
    return Object.values(c.managed ?? {});
}

export async function addManagedChannel(id: string, entry: { key?: string; label: string; channelId: string }) {
    return writeChannels(id, (c: any) => {
        const next = clone(c);
        next.managed = next.managed ?? {};
        const key = entry.key ?? generateKey(entry.label, Object.keys(next.managed));
        next.managed[key] = { id: key, label: entry.label, channelId: entry.channelId };
        return next;
    });
}

export async function updateManagedChannel(id: string, identifier: string, patch: Partial<{ label: string; channelId: string }>) {
    return writeChannels(id, (c: any) => {
        const next = clone(c);
        const k = resolveManagedKey(next.managed ?? {}, identifier);
        if (!k) return next;
        next.managed[k] = { ...next.managed[k], ...patch };
        return next;
    });
}

export async function removeManagedChannel(id: string, identifier: string) {
    return writeChannels(id, (c: any) => {
        const next = clone(c);
        const k = resolveManagedKey(next.managed ?? {}, identifier);
        if (k) delete next.managed[k];
        return next;
    });
}

export async function getRole(id: string, key: string) {
    const r = await readRoles(id);
    return r?.[key] ?? null;
}

export async function upsertRole(id: string, key: string, patch: any) {
    return writeRoles(id, (r: any) => ({ ...r, [key]: { ...(r?.[key] ?? {}), ...patch, updatedAt: new Date().toISOString() } }));
}

export async function removeRole(id: string, key: string) {
    return writeRoles(id, (r: any) => {
        if (!r?.[key]) return r;
        const { [key]: _omit, ...rest } = r;
        return rest;
    });
}

// ----------------------------- UTILS -----------------------------
function generateKey(label: string, existingKeys: string[]) {
    const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
    let k = base || "key";
    let i = 1;
    while (existingKeys.includes(k)) k = `${base}-${i++}`;
    return k;
}

function resolveManagedKey(managed: Record<string, any>, identifier: string) {
    if (!managed) return null;
    if (managed[identifier]) return identifier;
    const asEntry = Object.entries(managed).find(([, v]) => v?.label === identifier);
    return asEntry ? asEntry[0] : null;
}


// Minimal action-key normalization so you don't end up with 5 spellings of the same thing.
const normAction = (k: string) => k.trim().toLowerCase().replace(/[\s-]+/g, "_");

// Ensure role record exists inside roles JSON without doing extra round-trips.
async function ensureRole(guildId: string, roleKey: string) {
    return writeRoles(guildId, (roles: any = {}) => {
        const ex = roles[roleKey] ?? {};
        roles[roleKey] = {
            ...ex,
            reach: ex.reach ?? {},   // overrides map
            limits: ex.limits ?? {}, // limits map
            updatedAt: new Date().toISOString(),
        };
        return roles;
    });
}

/* ===================== OVERRIDES ===================== */

export async function getRoleOverrides(guildId: string, roleKey: string) {
    const roles = await readRoles(guildId);
    return { ...(roles?.[roleKey]?.reach ?? {}) };
}

export async function setRoleOverride(
    guildId: string,
    roleKey: string,
    actionKey: string,
    override: any,           // e.g. "allow" | "deny" | config object — your call
    _db?: unknown,           // optional tx placeholder, ignored here
): Promise<void> {
    await writeRoles(guildId, (roles: any = {}) => {
        const k = normAction(actionKey);
        const ex = roles[roleKey] ?? {};
        const reach = { ...(ex.reach ?? {}) };
        reach[k] = override;
        roles[roleKey] = { ...ex, reach, updatedAt: new Date().toISOString() };
        return roles;
    });
}

export async function clearRoleOverride(
    guildId: string,
    roleKey: string,
    actionKey: string,
    _db?: unknown,
): Promise<boolean> {
    let removed = false;
    await writeRoles(guildId, (roles: any = {}) => {
        const ex = roles[roleKey];
        if (!ex?.reach) return roles;
        const k = normAction(actionKey);
        if (!(k in ex.reach)) return roles;
        const reach = { ...ex.reach };
        delete reach[k];
        removed = true;
        roles[roleKey] = { ...ex, reach, updatedAt: new Date().toISOString() };
        return roles;
    });
    return removed;
}

export async function resetRoleOverrides(
    guildId: string,
    roleKey: string,
    _db?: unknown,
): Promise<void> {
    await writeRoles(guildId, (roles: any = {}) => {
        const ex = roles[roleKey] ?? {};
        roles[roleKey] = { ...ex, reach: {}, updatedAt: new Date().toISOString() };
        return roles;
    });
}

/* ====================== LIMITS ======================= */

export async function getRoleLimits(guildId: string, roleKey: string) {
    const roles = await readRoles(guildId);
    return { ...(roles?.[roleKey]?.limits ?? {}) };
}

export async function setRoleLimit(
    guildId: string,
    roleKey: string,
    actionKey: string,
    limit: { limit: number; window?: string | null; windowSeconds?: number | null },
    _db?: unknown,
): Promise<void> {
    await writeRoles(guildId, (roles: any = {}) => {
        const k = normAction(actionKey);
        const ex = roles[roleKey] ?? {};
        const limits = { ...(ex.limits ?? {}) };
        limits[k] = {
            limit: limit.limit,
            window: limit.window ?? null,
            windowSeconds: limit.windowSeconds ?? null,
        };
        roles[roleKey] = { ...ex, limits, updatedAt: new Date().toISOString() };
        return roles;
    });
}

export async function clearRoleLimit(
    guildId: string,
    roleKey: string,
    actionKey: string,
    _db?: unknown,
): Promise<boolean> {
    let removed = false;
    await writeRoles(guildId, (roles: any = {}) => {
        const ex = roles[roleKey];
        if (!ex?.limits) return roles;
        const k = normAction(actionKey);
        if (!(k in ex.limits)) return roles;
        const limits = { ...ex.limits };
        delete limits[k];
        removed = true;
        roles[roleKey] = { ...ex, limits, updatedAt: new Date().toISOString() };
        return roles;
    });
    return removed;
}


// Create a role if missing without changing anything else.
// Useful before bulk-setting multiple overrides/limits in one place.
export async function ensureRoleExists(guildId: string, roleKey: string): Promise<void> {
    await ensureRole(guildId, roleKey);
}
