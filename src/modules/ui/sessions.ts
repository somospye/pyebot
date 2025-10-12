/** Minutes a callback remains available before being reclaimed. */
export const TIME_TO_LIVE = 5;
/** Sweep cadence (ms). */
const CLEANUP_INTERVAL_MS = 60_000;

/** Generic callback signature. */
export type Callback<C, R = unknown> = (ctx: C) => Promise<R>;

/** Brand an id with the callback types so the compiler can track them. */
export type CallbackId<C, R = unknown> = string & { __ctx?: C; __ret?: R };

interface SessionEntry {
    callback: (ctx: unknown) => Promise<unknown>;
    createdAt: number;
}

/** Single registry for heterogeneous callbacks with TTL and cleanup. */
export class SessionRegistry {
    private readonly callbacks = new Map<string, SessionEntry>();
    private readonly ttlMs: number;
    private janitor?: ReturnType<typeof setInterval>;

    constructor(ttlMinutes: number = TIME_TO_LIVE) {
        this.ttlMs = ttlMinutes * 60_000;
        this.janitor = setInterval(() => this.purgeExpired(), CLEANUP_INTERVAL_MS);
        // Node-only nicety; harmless elsewhere.
        (this.janitor as any)?.unref?.();
    }

    /**
     * Registers a callback and returns a typed id that preserves C/R at compile time.
     * If baseId already contains ':', we assume it's unique enough and use as-is.
     */
    register<C, R = unknown>(baseId: string, cb: Callback<C, R>): CallbackId<C, R> {
        const uniqueId = baseId.includes(":") ? baseId : makeID(baseId);
        this.callbacks.set(uniqueId, {
            callback: cb as (ctx: unknown) => Promise<unknown>,
            createdAt: Date.now(),
        });
        return uniqueId as CallbackId<C, R>;
    }

    /**
     * Resolve a typed id back to its typed callback if still valid.
     * Use this when you held onto the id returned by `register`.
     */
    get<C, R = unknown>(id: CallbackId<C, R>): Callback<C, R> | undefined {
        const entry = this.callbacks.get(id as string);
        if (!entry) return undefined;
        if (this.isExpired(entry.createdAt)) {
            this.callbacks.delete(id as string);
            return undefined;
        }
        return entry.callback as unknown as Callback<C, R>;
    }

    /**
     * Unsafe resolve by raw string. You’ll get `unknown` types back.
     * Useful with external sources (e.g., Discord customId).
     */
    getUnsafe(id: string): ((ctx: unknown) => Promise<unknown>) | undefined {
        const entry = this.callbacks.get(id);
        if (!entry) return undefined;
        if (this.isExpired(entry.createdAt)) {
            this.callbacks.delete(id);
            return undefined;
        }
        return entry.callback;
    }

    /** Invoke and return undefined if not found/expired. */
    async invoke<C, R = unknown>(id: CallbackId<C, R>, ctx: C): Promise<R | undefined> {
        const cb = this.get<C, R>(id);
        return cb ? cb(ctx) : undefined;
    }

    delete(id: string | CallbackId<any, any>): boolean {
        return this.callbacks.delete(id as string);
    }

    clear(): void {
        this.callbacks.clear();
    }

    private isExpired(createdAt: number): boolean {
        return Date.now() - createdAt >= this.ttlMs;
    }

    private purgeExpired(): void {
        const now = Date.now();
        for (const [id, entry] of this.callbacks) {
            if (now - entry.createdAt >= this.ttlMs) {
                this.callbacks.delete(id);
            }
        }
    }
}

/** Shared registry instance. */
export const session = new SessionRegistry();

/** Thin helpers */
export const registerSessionCallback = <C, R = unknown>(
    baseId: string,
    cb: Callback<C, R>,
): CallbackId<C, R> => session.register(baseId, cb);

export const getSessionCallback = <C, R = unknown>(
    id: CallbackId<C, R>,
): Callback<C, R> | undefined => session.get(id);

export const getSessionCallbackUnsafe = (
    id: string,
): ((ctx: unknown) => Promise<unknown>) | undefined => session.getUnsafe(id);

export const removeSessionCallback = (id: string | CallbackId<any, any>): boolean =>
    session.delete(id);


/**
 * Creates a unique ID, used for customIDs of buttons, menus, modals, etc.
 * * If the ID contains `defer` anywhere, the handler will automatically defer the interaction.
 * - This is used because some interactions such as modal opening should not be deferred immediately.
 * - But other's, such as updating a message should be deferred.
 * - Deferring is handled automatically by methods such as `Button.onClick()`. or `StringSelectMenu.onSelect()`.
 * @param base 
 * @returns 
 */
export function makeID(base: string, defer: boolean = true): string {
    const suffix = Math.random().toString(36).slice(2, 10);
    return `${base}:${suffix}` + (defer ? ":defer" : "");
}


/**
 * ----------- HANDLERS API ------------
 * These functions are used by handlers to manage callbacks.
 * id_exists() - should be used at `filter` stage to check if a callback with the given id exists (and is not expired).
 * resolveAndInvoke() - should be used at `run` stage to resolve by raw string and invoke with the ctx you provide.
 * Returns true if invoked, false if not found/expired.
 * --------------------------------------
 */


// Checks if a callback with the given id exists (and is not expired).
export async function id_exists(id: string): Promise<boolean> {
    return session.getUnsafe(id) !== undefined;
}


// Resolves by raw string and invokes with the ctx you provide.
// Returns true if invoked, false if not found/expired.
export async function resolveAndInvoke(customId: string, ctx: unknown): Promise<boolean> {
    const cb = session.getUnsafe(customId);
    if (!cb) return false;
    await cb(ctx);
    return true;
}
