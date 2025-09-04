import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface CacheOptions {
  persistPath?: string;
  persistIntervalMs?: number;
  cleanupIntervalMs?: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class Cache<TValue = unknown> {
  private store = new Map<string, CacheEntry<TValue>>();
  private persistPath?: string;

  constructor(options: CacheOptions = {}) {
    this.persistPath =
      options.persistPath ?? path.join(__dirname, "cache.json");
    const persistInterval = options.persistIntervalMs ?? 5 * 60 * 1000;
    const cleanupInterval = options.cleanupIntervalMs ?? 60 * 60 * 1000;

    if (this.persistPath && existsSync(this.persistPath)) {
      try {
        const raw = JSON.parse(readFileSync(this.persistPath, "utf-8"));
        for (const [key, entry] of Object.entries<CacheEntry<TValue>>(raw)) {
          if (Date.now() < entry.expiresAt) {
            this.store.set(key, entry);
          }
        }
      } catch (err) {
        console.error("[Cache] Error leyendo persistencia:", err);
      }
    }

    if (this.persistPath) {
      setInterval(() => this.persist(), persistInterval);
    }

    setInterval(() => this.cleanup(), cleanupInterval);
  }

  async get(key: string): Promise<TValue | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: TValue, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  private persist(): void {
    if (!this.persistPath) return;
    const obj: Record<string, CacheEntry<TValue>> = {};
    for (const [key, entry] of this.store.entries()) {
      obj[key] = entry;
    }
    try {
      writeFileSync(this.persistPath, JSON.stringify(obj, null, 2), "utf-8");
    } catch (err) {
      console.error("[Cache] Error guardando persistencia:", err);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}
