/**
 * Infraestructura central para instrumentar módulos con el bus de depuración.
 */
import { EventEmitter } from "node:events";
import { performance } from "node:perf_hooks";

/**
 * Representa el momento en el que se dispara un evento de depuración.
 */
type DebugStage = "before" | "after" | "error";

interface InstrumentContext {
  instance: unknown;
  method: string;
  args: unknown[];
}

interface InstrumentAfterContext extends InstrumentContext {
  result: unknown;
  durationMs: number;
}

interface InstrumentErrorContext extends InstrumentContext {
  error: unknown;
  durationMs: number;
}

export type InstrumentHooks = {
  before?(context: InstrumentContext): unknown;
  after?(context: InstrumentAfterContext): unknown;
  error?(context: InstrumentErrorContext): unknown;
};

export type InstrumentMap = Record<string, InstrumentHooks>;

export interface DebugEvent {
  channel: string;
  method: string;
  stage: DebugStage;
  timestamp: number;
  durationMs?: number;
  data?: unknown;
  error?: unknown;
}

interface DebugSpec {
  channels: Set<string>;
  consoleChannels: Set<string>;
  consoleAll: boolean;
}

const INSTRUMENTED = Symbol("debug:instrumented");

/**
 * Parsea la variable DEBUG (ej. "automod,automod:no-console,console") y arma
 * la configuración inicial de canales. Se acepta "*" como comodín.
 * - "canal" habilita la instrumentación y también la consola.
 * - "canal:no-console" habilita la instrumentación sin ruido en consola.
 * - "console" o "*:console" escriben todos los eventos a la consola. 
 */
function parseDebugSpec(): DebugSpec {
  const tokens = (process.env.DEBUG ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const channels = new Set<string>();
  const consoleChannels = new Set<string>();
  let consoleAll = false;

  for (const token of tokens) {
    if (token === "console") {
      consoleAll = true;
      continue;
    }

    const [channelRaw, optionRaw] = token.split(":");
    const channel = channelRaw?.trim();
    const option = optionRaw?.trim()?.toLowerCase();

    if (!channel) continue;

    channels.add(channel);

    if (channel === "*") {
      if (!option || option === "console") {
        consoleAll = true;
      }
      continue;
    }

    if (!option || option === "console") {
      consoleChannels.add(channel);
    }
  }

  return { channels, consoleChannels, consoleAll };
}

const debugSpec = parseDebugSpec();

export class DebugBus extends EventEmitter {
  private channels: Set<string>;

  constructor(initialChannels: string[] = []) {
    super();
    this.channels = new Set(initialChannels);
  }

  enable(channel: string): void {
    this.channels.add(channel);
  }

  disable(channel: string): void {
    this.channels.delete(channel);
  }

  isChannelEnabled(channel: string): boolean {
    return this.channels.has("*") || this.channels.has(channel);
  }

  emitEvent(event: DebugEvent): void {
    if (!this.isChannelEnabled(event.channel)) {
      return;
    }

    super.emit(event.channel, event);
    super.emit("*", event);
  }
}

/**
 * Bus global de depuración con los canales iniciales habilitados desde DEBUG.
 */
export const debugBus = new DebugBus([...debugSpec.channels]);

/**
 * Indica si un canal fue solicitado explícitamente (o mediante comodín "*").
 */
export function isDebugChannelRequested(channel: string): boolean {
  return (
    debugSpec.channels.has("*") || debugSpec.channels.has(channel)
  );
}

/**
 * Indica si se debe mostrar el canal en consola. Respeta comodines y la clave
 * especial "console" dentro de DEBUG.
 */
export function shouldReportToConsole(channel: string): boolean {
  if (debugSpec.consoleAll) return true;
  return (
    debugSpec.consoleChannels.has("*") ||
    debugSpec.consoleChannels.has(channel)
  );
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Promise<unknown>).then === "function"
  );
}

function buildEvent(
  channel: string,
  method: string,
  stage: DebugStage,
  payload: {
    data?: unknown;
    error?: unknown;
    durationMs?: number;
  },
): DebugEvent {
  return {
    channel,
    method,
    stage,
    timestamp: Date.now(),
    durationMs: payload.durationMs,
    data: payload.data,
    error: payload.error,
  };
}

/**
 * Envuelve los métodos del prototipo indicado para emitir eventos de depuración
 * sin tener que salpicar el código productivo con logs manuales.
 */
export function instrumentMethods(
  prototype: Record<string, unknown>,
  channel: string,
  hooks: InstrumentMap,
): void {
  for (const [method, config] of Object.entries(hooks)) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
    if (!descriptor || typeof descriptor.value !== "function") continue;

    const original = descriptor.value;
    if ((original as Record<PropertyKey, unknown>)[INSTRUMENTED]) continue;

    const wrapped = function wrappedMethod(this: unknown, ...args: unknown[]) {
      if (!debugBus.isChannelEnabled(channel)) {
        return Reflect.apply(original, this, args);
      }

      const baseContext: InstrumentContext = {
        instance: this,
        method,
        args,
      };

      const start = performance.now();

      const beforeData = config.before?.(baseContext);
      if (beforeData !== undefined) {
        debugBus.emitEvent(
          buildEvent(channel, method, "before", { data: beforeData }),
        );
      }

      try {
        const result = Reflect.apply(original, this, args);

        if (isPromiseLike(result)) {
          const promise = result.then(
            (value) => {
              const duration = performance.now() - start;
              const afterData = config.after?.({
                ...baseContext,
                result: value,
                durationMs: duration,
              });

              debugBus.emitEvent(
                buildEvent(channel, method, "after", {
                  data: afterData,
                  durationMs: duration,
                }),
              );

              return value;
            },
            (error) => {
              const duration = performance.now() - start;
              const errorData = config.error?.({
                ...baseContext,
                error,
                durationMs: duration,
              });

              debugBus.emitEvent(
                buildEvent(channel, method, "error", {
                  data: errorData,
                  error,
                  durationMs: duration,
                }),
              );

              throw error;
            },
          );

          return promise;
        }

        const duration = performance.now() - start;
        const afterData = config.after?.({
          ...baseContext,
          result,
          durationMs: duration,
        });

        debugBus.emitEvent(
          buildEvent(channel, method, "after", {
            data: afterData,
            durationMs: duration,
          }),
        );

        return result;
      } catch (error) {
        const duration = performance.now() - start;
        const errorData = config.error?.({
          ...baseContext,
          error,
          durationMs: duration,
        });

        debugBus.emitEvent(
          buildEvent(channel, method, "error", {
            data: errorData,
            error,
            durationMs: duration,
          }),
        );

        throw error;
      }
    };

    (wrapped as unknown as Record<PropertyKey, unknown>)[INSTRUMENTED] = true;

    Object.defineProperty(prototype, method, {
      ...descriptor,
      value: wrapped,
    });
  }
}

export interface ConsoleReporterOptions {
  filter?: (event: DebugEvent) => boolean;
  format?: (event: DebugEvent) => unknown;
}

/**
 * Adjunta un reporter simple a la consola para inspeccionar eventos rápido.
 */
export function attachConsoleReporter(
  options: ConsoleReporterOptions = {},
): () => void {
  const { filter, format } = options;

  const listener = (event: DebugEvent) => {
    if (filter && !filter(event)) return;

    const { channel, method, stage, durationMs, data, error } = event;
    const durationText =
      typeof durationMs === "number" ? `${durationMs.toFixed(2)}ms` : "";
    const suffix = durationText ? ` (${durationText})` : "";
    const header = `[debug][${channel}] ${method}:${stage}${suffix}`;

    if (format) {
      console.debug(header, format(event));
      return;
    }

    if (error) {
      const casted = error as Error;
      console.debug(
        header,
        data ?? {
          errorName: casted.name,
          errorMessage: casted.message,
        },
      );
      return;
    }

    console.debug(header, data ?? null);
  };

  debugBus.on("*", listener);

  return () => {
    debugBus.off("*", listener);
  };
}
