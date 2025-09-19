/**
 * Instrumentación específica del módulo AutoMod para el bus de depuración.
 * 
 * Esto permite monitorear en detalle el comportamiento del sistema sin
 * necesidad de agregar logs manuales en el código.
 * 
 * Es horrible lo se...
 */
import type { Message } from "seyfert";
import {
  attachConsoleReporter,
  debugBus,
  instrumentMethods,
  isDebugChannelRequested,
  shouldReportToConsole,
  type InstrumentMap,
} from "./index";

const DEBUG_CHANNEL = "automod";

const queueDepthByInstance = new WeakMap<object, number>();
let consoleReporterAttached = false;

/** Calcula el tamaño del buffer cuando llega como ArrayBuffer o view. */
function bufferSize(value: unknown): number | null {
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return (value as ArrayBufferView).byteLength;
  return null;
}

/** Crea un resumen breve del texto para los eventos de depuración. */
function previewText(text: string | undefined, limit: number): string | null {
  if (!text) return null;
  if (text.length <= limit) return text;
  return text.slice(0, limit) + "…";
}

/** Extrae los campos clave de un adjunto sin exponer datos innecesarios. */
function summarizeAttachment(attachment: unknown) {
  if (!attachment || typeof attachment !== "object") return null;
  const anyAttachment = attachment as Record<string, unknown>;
  return {
    id: anyAttachment.id ?? null,
    contentType: anyAttachment.contentType ?? null,
    size: anyAttachment.size ?? null,
    width: anyAttachment.width ?? null,
    height: anyAttachment.height ?? null,
    name: anyAttachment.name ?? null,
    url: anyAttachment.url ?? null,
  };
}

/** Serializa los datos básicos del mensaje que se está analizando. */
function summarizeMessage(message: Message | undefined) {
  if (!message) return null;

  const attachments = Array.from(message.attachments ?? []).map((attachment) =>
    summarizeAttachment(attachment),
  );

  return {
    id: (message as unknown as Record<string, unknown>).id ?? null,
    authorId: message.author?.id ?? null,
    channelId: (message as unknown as Record<string, unknown>).channelId ?? null,
    contentPreview: previewText(message.content, 180),
    contentLength: message.content?.length ?? 0,
    attachments,
  };
}

/** Estandariza cómo mostramos los errores en los eventos. */
function summarizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { value: error };
}

/** Lleva la cuenta del tamaño de la cola OCR por instancia instrumentada. */
function adjustQueue(instance: unknown, delta: number): number {
  if (!instance || (typeof instance !== "object" && typeof instance !== "function")) {
    return 0;
  }

  const current = queueDepthByInstance.get(instance as object) ?? 0;
  const next = Math.max(0, current + delta);
  queueDepthByInstance.set(instance as object, next);
  return next;
}

/** Conecta un reporter a consola cuando el canal lo solicita. */
function ensureConsoleReporter(): void {
  if (consoleReporterAttached || !shouldReportToConsole(DEBUG_CHANNEL)) {
    return;
  }

  attachConsoleReporter({
    filter: (event) => event.channel === DEBUG_CHANNEL,
  });

  consoleReporterAttached = true;
}

/** Permite forzar la instrumentación desde tests o scripts. */
interface RegisterOptions {
  force?: boolean;
}

/**
 * Instrumenta el AutoMod para sacar telemetría detallada sin tocar el código
 * productivo. Sólo se activa si el canal fue pedido en la variable DEBUG o si
 * se fuerza vía options.force.
 */
export function registerAutoModDebug(
  target: { prototype: Record<string, unknown> },
  options: RegisterOptions = {},
): void {
  const shouldEnable = options.force || isDebugChannelRequested(DEBUG_CHANNEL);
  if (!shouldEnable) return;

  const methods: InstrumentMap = {
    analyzeUserMessage: {
      before: ({ args }) => ({
        message: summarizeMessage(args[0] as Message),
      }),
      after: ({ result }) => ({
        actionTaken: Boolean(result),
      }),
      error: ({ error }) => summarizeError(error),
    },
    runSpamFilters: {
      before: ({ args }) => ({
        normalizedContentPreview: previewText(args[1] as string, 160),
        normalizedContentLength: (args[1] as string | undefined)?.length ?? 0,
      }),
      after: ({ result }) => ({
        matched: Boolean(result),
      }),
      error: ({ error }) => summarizeError(error),
    },
    shouldScanAttachments: {
      before: ({ args }) => ({
        attachments: Array.isArray(args[1])
          ? (args[1] as unknown[]).map((attachment) =>
              summarizeAttachment(attachment),
            )
          : [],
      }),
      after: ({ result }) => ({
        willScan: Boolean(result),
      }),
    },
    handleAttachment: {
      before: ({ args }) => ({
        message: summarizeMessage(args[0] as Message),
        attachment: summarizeAttachment(args[1]),
      }),
      after: ({ result }) => ({
        actionTaken: Boolean(result),
      }),
      error: ({ error }) => summarizeError(error),
    },
    fetchAttachmentBuffer: {
      before: ({ args }) => ({ url: args[0] ?? null }),
      after: ({ result }) => ({
        byteLength: bufferSize(result),
      }),
      error: ({ error }) => summarizeError(error),
    },
    preprocessImage: {
      after: ({ result }) => ({
        byteLength: bufferSize(result),
      }),
      error: ({ error }) => summarizeError(error),
    },
    analyzeImage: {
      after: ({ result, args }) => {
        const buffer = args[0];
        const bufferInfo = { byteLength: bufferSize(buffer) };

        const match = result as RegExp | undefined | null;

        return {
          match: match ? match.toString() : null,
          buffer: bufferInfo,
        };
      },
      error: ({ error }) => summarizeError(error),
    },
    enqueueOcrTask: {
      before: ({ instance, args }) => ({
        queueDepth: adjustQueue(instance, 1),
        taskName:
          typeof args[0] === "function" && (args[0] as Function).name
            ? (args[0] as Function).name
            : "anonymous",
      }),
      after: ({ instance, result }) => ({
        queueDepth: adjustQueue(instance, -1),
        textPreview:
          typeof result === "string" ? previewText(result, 200) : null,
        textLength: typeof result === "string" ? result.length : null,
      }),
      error: ({ instance, error }) => ({
        queueDepth: adjustQueue(instance, -1),
        error: summarizeError(error),
      }),
    },
    flagSuspiciousImage: {
      before: ({ args }) => ({
        message: summarizeMessage(args[0] as Message),
        attachmentUrl: args[1] ?? null,
      }),
      error: ({ error }) => summarizeError(error),
    },
    notifySuspiciousActivity: {
      before: ({ args }) => ({
        warning: args[0],
        referenceUrl: args[1],
      }),
      error: ({ error }) => summarizeError(error),
    },
  };

  instrumentMethods(target.prototype, DEBUG_CHANNEL, methods);
  debugBus.enable(DEBUG_CHANNEL);
  ensureConsoleReporter();
}
