import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export interface CacheOptions {
  /** Ruta donde se guardará el archivo de persistencia (opcional) */
  persistPath?: string;
  /** Intervalo para persistir a disco en ms (por defecto: 5 min) */
  persistIntervalMs?: number;
  /** Intervalo para limpiar expirados en ms (por defecto: 1 hora) */
  cleanupIntervalMs?: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class Cache {
  private store = new Map<string, CacheEntry<any>>();
  private persistPath?: string;

  constructor(options: CacheOptions = {}) {
    this.persistPath =
      options.persistPath ?? path.join(__dirname, "cache.json");
    const persistInterval = options.persistIntervalMs ?? 5 * 60 * 1000;
    const cleanupInterval = options.cleanupIntervalMs ?? 60 * 60 * 1000;

    // Cargar desde disco si existe
    if (this.persistPath && existsSync(this.persistPath)) {
      try {
        const raw = JSON.parse(readFileSync(this.persistPath, "utf-8"));
        for (const [key, entry] of Object.entries<CacheEntry<any>>(raw)) {
          if (Date.now() < entry.expiresAt) {
            this.store.set(key, entry);
          }
        }
      } catch (err) {
        console.error("[Cache] Error leyendo persistencia:", err);
      }
    }

    // Persistir automáticamente
    if (this.persistPath) {
      setInterval(() => this.persist(), persistInterval);
    }

    // Limpieza automática
    setInterval(() => this.cleanup(), cleanupInterval);
  }

  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T = any>(key: string, value: T, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  private persist(): void {
    if (!this.persistPath) return;
    const obj: Record<string, CacheEntry<any>> = {};
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
