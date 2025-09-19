import { randomBytes } from "node:crypto";

const CROCKFORD_BASE32_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const SLUG_LENGTH = 5;
const BASE = CROCKFORD_BASE32_ALPHABET.length;
const RANDOM_BYTES = 4; // 32 bits, múltiplo exacto de 2^25.
const SHIFT = 7; // quitamos 7 bits para quedarnos con 25 uniformes.

/**
 * Genera un slug base32 (Crockford) en minúsculas fácil de leer y escribir.
 *
 * Se toman 25 bits uniformes (32^5 ≈ 33M combinaciones) para mantenerlo corto
 * y con baja probabilidad de choque.
 *
 * Lo usamos como ID de warn para evitar duplicados y números confusos.
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
 * Valida si la cadena dada respeta el formato del slug de warn.
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
