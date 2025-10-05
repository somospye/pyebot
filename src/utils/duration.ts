import { parse as parseMilliseconds } from "./ms";

const SECONDS_IN_MILLISECOND = 1000;
const NUMERIC_PATTERN = /^\d+$/;

/**
 * Parses a duration string into seconds.
 * Accepts either a plain number (in seconds) or a string with time units (e.g., "5m", "2h").
 * Returns the duration in seconds, or null if the input is invalid.
 */
export function parseDuration(raw: string): number | null {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (NUMERIC_PATTERN.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  }

  const milliseconds = parseMilliseconds(trimmed);
  if (milliseconds === undefined || milliseconds <= 0) return null;

  const seconds = milliseconds / SECONDS_IN_MILLISECOND;
  return Number.isInteger(seconds) ? seconds : null;
}
