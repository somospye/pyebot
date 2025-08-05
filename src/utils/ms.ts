const timeUnits: Record<string, number> = {
  ms: 1,
  millisecond: 1,
  milliseconds: 1,

  s: 1000,
  sec: 1000,
  secs: 1000,
  second: 1000,
  seconds: 1000,

  m: 60_000,
  min: 60_000,
  mins: 60_000,
  minute: 60_000,
  minutes: 60_000,

  h: 3_600_000,
  hr: 3_600_000,
  hrs: 3_600_000,
  hour: 3_600_000,
  hours: 3_600_000,

  d: 86_400_000,
  day: 86_400_000,
  days: 86_400_000,

  w: 604_800_000,
  week: 604_800_000,
  weeks: 604_800_000,

  y: 31_557_600_000,
  year: 31_557_600_000,
  years: 31_557_600_000,
};

const preferredUnits: [string, number][] = [
  ["y", timeUnits.y],
  ["w", timeUnits.w],
  ["d", timeUnits.d],
  ["h", timeUnits.h],
  ["m", timeUnits.m],
  ["s", timeUnits.s],
  ["ms", timeUnits.ms],
];

export function parse(str: string): number | undefined {
  if (typeof str !== "string") return;

  const parts = str
    .trim()
    .toLowerCase()
    .split(/[\s,]+/);
  let total = 0;

  for (let i = 0; i < parts.length; i += 2) {
    const value = parseFloat(parts[i]);
    const unit = parts[i + 1];

    if (Number.isNaN(value) || !unit || !(unit in timeUnits)) {
      return;
    }

    total += value * timeUnits[unit];
  }

  return total;
}

export function format(ms: number, long = false): string {
  const abs = Math.abs(ms);
  const parts: string[] = [];

  let remaining = abs;

  for (const [unit, unitMs] of preferredUnits) {
    if (remaining >= unitMs) {
      const value = Math.floor(remaining / unitMs);
      remaining %= unitMs;

      parts.push(
        long ? `${value} ${longUnitName(unit, value)}` : `${value}${unit}`,
      );
    }
  }

  if (parts.length === 0) {
    return long ? `0 milliseconds` : `0ms`;
  }

  return parts.join(long ? ", " : " ");
}

function longUnitName(short: string, value: number): string {
  const unitMap: Record<string, string> = {
    ms: "millisecond",
    s: "second",
    m: "minute",
    h: "hour",
    d: "day",
    w: "week",
    y: "year",
  };

  const base = unitMap[short] ?? short;
  return value === 1 ? base : `${base}s`;
}

export default {
  parse,
  format,
};
