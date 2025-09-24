import {
  attachConsoleReporter,
  instrumentMethods,
  isDebugChannelRequested,
  shouldReportToConsole,
  type InstrumentMap,
} from "./index";


const DEBUG_CHANNEL = "rate-limiter";

const INSTRUMENTED = new WeakSet<object>();
let consoleAttached = false;

function ensureConsoleReporter(): void {
  if (consoleAttached || !shouldReportToConsole(DEBUG_CHANNEL)) {
    return;
  }

  attachConsoleReporter({
    filter: (event) => event.channel === DEBUG_CHANNEL,
    format: (event) => event.data,
  });

  consoleAttached = true;
}

function summarizeKey(rawKey: unknown): { key: string; guildId?: string; roleKey?: string; actionKey?: string } {
  if (typeof rawKey !== "string") {
    return { key: String(rawKey ?? "") };
  }

  const [guildId, roleKey, actionKey] = rawKey.split(":");
  return { key: rawKey, guildId, roleKey, actionKey };
}

interface RegisterOptions {
  force?: boolean;
}

export function registerRateLimiterDebug(
  ctor: { prototype: object },
  options: RegisterOptions = {},
): void {
  const shouldEnable = options.force || isDebugChannelRequested(DEBUG_CHANNEL);
  if (!shouldEnable) return;
  if (INSTRUMENTED.has(ctor.prototype)) return;

  ensureConsoleReporter();

  const hooks: InstrumentMap = {
    consume: {
      before: ({ args }) => ({
        stage: "consume:before",
        key: summarizeKey(args[0]),
        uses: args[1],
        windowSeconds: args[2],
      }),
      after: ({ args, result }) => ({
        stage: "consume:after",
        key: summarizeKey(args[0]),
        uses: args[1],
        windowSeconds: args[2],
        outcome: result,
      }),
      error: ({ args, error }) => ({
        stage: "consume:error",
        key: summarizeKey(args[0]),
        error,
      }),
    },
    rollback: {
      before: ({ args }) => ({
        stage: "rollback:before",
        key: summarizeKey(args[0]),
      }),
      after: ({ args }) => ({
        stage: "rollback:after",
        key: summarizeKey(args[0]),
      }),
      error: ({ args, error }) => ({
        stage: "rollback:error",
        key: summarizeKey(args[0]),
        error,
      }),
    },
  };

  // @ts-ignore
  instrumentMethods(ctor.prototype, DEBUG_CHANNEL, hooks);
  INSTRUMENTED.add(ctor.prototype);
}
