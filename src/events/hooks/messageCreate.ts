import type { ResolveEventParams } from "seyfert";
import { createEventHook } from "@/events/hooks/createEventHook";

/** Parametros tipados que Seyfert provee al evento `messageCreate`. */
export type MessageCreateArgs = ResolveEventParams<"messageCreate">;
export type MessageCreateListenerArgs = [
  MessageCreateArgs[0],
  MessageCreateArgs[1],
  MessageCreateArgs[2]?,
];
export type MessageCreateListener = (
  ...args: MessageCreateListenerArgs
) => Promise<void> | void;

export const [
  /**
 * Registra un listener permanente para `messageCreate`.
 * Devuelve una funcion que permite removerlo facilmente.
 */
  onMessageCreate,

  /** Registra un listener de unica ejecucion para `messageCreate`. */
  onceMessageCreate,

  /** Elimina un listener previamente registrado para `messageCreate`. */
  offMessageCreate,

  /** Ejecuta todos los listeners registrados propagando los datos originales del evento. */
  emitMessageCreate,

  /** Elimina todos los listeners actualmente registrados para `messageCreate`. */
  clearMessageCreateListeners,
] = createEventHook<MessageCreateListenerArgs>().make();


