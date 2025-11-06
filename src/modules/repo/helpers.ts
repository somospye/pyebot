

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

