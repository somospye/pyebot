interface IFilter {
  filter: RegExp;
  mute: boolean;
  warnMessage?: string;
}

const LINK_SOSPECHOSO = "🚫 Enlace sospechoso.";
const SPAM_BOT = "🚫 Spam bot.";

export const spamFilterList: IFilter[] = [
  {
    filter: /https?:\/\/[\w.-]+\.xyz($|\W)/i,
    mute: false,
    warnMessage: LINK_SOSPECHOSO,
  },
  {
    filter: /https?:\/\/[\w.-]+\.click($|\W)/i,
    mute: false,
    warnMessage: LINK_SOSPECHOSO,
  },
  {
    filter: /https?:\/\/[\w.-]+\.info($|\W)/i,
    mute: false,
    warnMessage: LINK_SOSPECHOSO,
  },
  {
    filter: /https?:\/\/[\w.-]+\.ru($|\W)/i,
    mute: false,
    warnMessage: LINK_SOSPECHOSO,
  },
  {
    filter: /https?:\/\/[\w.-]+\.biz($|\W)/i,
    mute: false,
    warnMessage: LINK_SOSPECHOSO,
  },
  {
    filter: /https?:\/\/[\w.-]+\.online($|\W)/i,
    mute: false,
    warnMessage: LINK_SOSPECHOSO,
  },
  {
    filter: /https?:\/\/[\w.-]+\.club($|\W)/i,
    mute: false,
    warnMessage: LINK_SOSPECHOSO,
  },
  {
    filter: /(https?:\/\/)?(t\.me|telegram\.me|wa\.me|whatsapp\.me)\/.+/i,
    mute: true,
  },
  {
    filter: /(https?:\/\/)?(pornhub|xvideos|xhamster|xnxx|hentaila)(\.\S+)+\//i,
    mute: true,
  },
  {
    filter:
      /(?!(https?:\/\/)?discord\.gg\/programacion$)(https?:\/\/)?discord\.gg\/\w+/i,
    mute: false,
  },
  {
    filter:
      /(?!(https?:\/\/)?discord\.com\/invite\/programacion$)(https?:\/\/)?discord\.com\/invite\/.+/i,
    mute: true,
  },
  {
    filter: /(https?:\/\/)?multiigims.netlify.app/i,
    mute: true,
  },
  { filter: /\[.*?steamcommunity\.com\/.*\]/i, mute: true },
  {
    filter: /https?:\/\/(www\.)?\w*solara\w*\.\w+\/?/i,
    mute: true,
    warnMessage: SPAM_BOT,
  },
  {
    filter: /(?:solara|wix)(?=.*\broblox\b)(?=.*(?:executor|free)).*/is,
    mute: true,
    warnMessage: SPAM_BOT,
  },
  {
    filter: /(?:https?:\/\/(?:www\.)?|www\.)?outlier\.ai\b/gi,
    mute: true,
    warnMessage: SPAM_BOT,
  },
  {
    filter:
      /(?=.*\b(eth|ethereum|btc|bitcoin|capital|crypto|memecoins|nitro|\$|nsfw)\b)(?=.*\b(gana\w*|gratis|multiplica\w*|inver\w*|giveaway|server|free|earn)\b)/is,
    mute: false,
    warnMessage: "Posible estafa detectada",
  },
];


/**
 * Convierte una frase sencilla en una RegExp robusta para detectar spam.
 *
 * Reglas:
 * - Tolerancia entre letras: permite espacios, puntuación o underscores entre CADA carácter
 *   de cada palabra literal (ej: "free bonus" casa "f.r_e e  bo-nus").
 * - Los espacios de la frase se tratan como separadores permisivos.
 * - Se añaden límites de palabra (\b) a ambos extremos para reducir falsos positivos.
 *
 * ### Tokens
 * - $number: número con formato común, opcionalmente precedido por $ y/o seguido de k/m/b.
 *    Ejemplos válidos: "$100", "1,000", "2.5k", "3.000,50", "$ 1 000", "5000b".
 * 
 * Ejemplos:
 *   phraseToSpamRegex("free bonus code")
 *   phraseToSpamRegex("receive your $number")
 */
export function phraseToSpamRegex(phrase: string): RegExp {
  const SEP = String.raw`[\s\W_]*`;
  const NUMBER = String.raw`\$?\s*(?:\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)(?:\s*[kKmMbB])?`;

  // Particiona por token $number (case-insensitive), espacios o literales.
  const parts = phrase.match(/(\$number)|\s+|[^\s]+/gi) ?? [];

  const body = parts
    .map(seg => {
      const s = seg.toString();
      if (/^\s+$/.test(s)) return SEP;                  // espacios → separador permisivo
      if (/^\$number$/i.test(s)) return NUMBER;         // token → patrón numérico
      // literal → permitir "basura" entre cada carácter
      return s
        .split("")
        .map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(SEP);
    })
    .join("");

  // Límites de palabra alrededor del cuerpo; flag 'i' para case-insensitive.
  return new RegExp(`\\b(?:${body})\\b`, "i");
}

/* Genera permutaciones de las "palabras" en la cadena dada.
 * Ejemplo: "a b c" -> ["a b c", "a c b", "b a c", "b c a", "c a b", "c b a"]
 * - Separa por espacios (cualquier cantidad).
 * - Maneja palabras repetidas sin duplicar resultados.
 */
function wordPermutations(s: string): string[] {
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length === 1) return [words[0]];

  // Ordena para poder saltar duplicados de forma estable
  const arr = [...words].sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
  const used = new Array(arr.length).fill(false);
  const result: string[] = [];
  const path: string[] = [];

  function backtrack() {
    if (path.length === arr.length) {
      result.push(path.join(" "));
      return;
    }
    let prev: string | undefined;
    for (let i = 0; i < arr.length; i++) {
      if (used[i]) continue;
      // Evita duplicados en el mismo nivel
      if (prev !== undefined && arr[i] === prev) continue;

      used[i] = true;
      path.push(arr[i]);
      backtrack();
      path.pop();
      used[i] = false;

      prev = arr[i];
    }
  }

  backtrack();
  return result;
}

// Canonical phrases (order-agnostic via permutations)
const BASE_PHRASES = [
  "free bonus code",
  "crypto casino",
  "receive your $number",
  "belowex",
  "evencas",
  "special promo code",
  "bonus instantly",
  "deleted one hour",
  "claim your reward",
  "free gift code",
  "take your free reward",
  "free nitro",
  "free nitro click here",
  "free discord nitro",   
  "claim your nitro",
] as const;

// Expand with permutations, dedupe, and compile
const PHRASES: string[] = Array.from(
  new Set(
    (BASE_PHRASES as readonly string[]).flatMap(wordPermutations)
  )
);

// ! Muy sensible a falsos positivos ! 
export const scamFilterList: RegExp[] = PHRASES.map(phraseToSpamRegex);