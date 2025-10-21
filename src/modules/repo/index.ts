// Single-file, flat module. No factories, no classes. Just dumb functions.
// Assumes a shared Drizzle instance exported from "@/db".
// If you ever need to test, you can still swap the module via jest/ts-node mocks.

import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { users } from "@/schemas/user";
import { guilds } from "@/schemas/guild";

// Tiny helper for JSON cloning at API edges only
const clone = <T>(v: T): T => (typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

// ----------------------------- USERS -----------------------------
export async function getUser(id: string) {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
}

export async function userExists(id: string) {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    return !!row;
}

export async function ensureUser(id: string, init: Partial<{ bank: number; cash: number; warns: any[] }> = {}) {
    const [inserted] = await db.insert(users).values({ id, ...init }).onConflictDoNothing().returning();
    if (inserted) return inserted;
    const existing = await getUser(id);
    if (!existing) throw new Error(`ensureUser failed (id=${id})`);
    return existing;
}

export async function upsertUser(id: string, patch: Partial<{ bank: number; cash: number; warns: any[] }> = {}) {
    const [row] = await db.insert(users).values({ id, ...patch }).onConflictDoUpdate({ target: users.id, set: { ...patch } }).returning();
    return row!;
}

export async function updateUser(id: string, patch: Partial<{ bank: number; cash: number; warns: any[] }>) {
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
