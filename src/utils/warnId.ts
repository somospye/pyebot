import { randomBytes } from "node:crypto";

const CROCKFORD_BASE32_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const SLUG_LENGTH = 5;
const BASE = CROCKFORD_BASE32_ALPHABET.length;
const RANDOM_BYTES = 4; // 32 bits -> perfect multiple of 2^25.
const SHIFT = 7; // drop 7 bits so we keep 25 uniformly distributed bits.

/**
 * Generates a lowercase Crockford base32 slug that is friendly to read and type.
 *
 * We sample 25 uniformly distributed bits (yielding 32^5 combinations ≈ 33M)
 * which keeps the slug short (5 chars) while making collisions extremely unlikely.
 *
 * Used for warn IDs. It's readable, case-insensitive, and avoids confusion between deleted IDs.
 */
export function generateWarnId(): string {
  const randomBuffer = randomBytes(RANDOM_BYTES);
  const randomValue = randomBuffer.readUInt32BE(0) >>> SHIFT;

  let value = randomValue;
  let slug = "";

  for (let i = 0; i < SLUG_LENGTH; i++) {
    const digit = value % BASE;
    slug = CROCKFORD_BASE32_ALPHABET[digit] + slug;
    value = Math.floor(value / BASE);
  }

  return slug;
}

/**
 * Checks whether the provided string matches the warn slug format.
 */
export function isValidWarnId(id: string): boolean {
  if (typeof id !== "string" || id.length !== SLUG_LENGTH) return false;
  for (const char of id) {
    if (!CROCKFORD_BASE32_ALPHABET.includes(char)) {
      return false;
    }
  }
  return true;
}

export const WARN_ID_LENGTH = SLUG_LENGTH;
