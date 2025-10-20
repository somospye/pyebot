import type { ResolveEventParams } from "seyfert";
import { createEventHook } from "@/events/hooks/createEventHook";

type HookSubscription = () => void;

type AsyncListener<TArgs extends readonly unknown[]> = (
  ...args: TArgs
) => Promise<void> | void;

/** Parametros tipados que Seyfert provee al evento `messageReactionAdd`. */
export type ReactionArgs = ResolveEventParams<"messageReactionAdd">;
export type ReactionAddListener = AsyncListener<ReactionArgs>;
export type ReactionAddSubscription = HookSubscription;

const reactionAddHook = createEventHook<ReactionArgs>();

/**
 * Registra un listener permanente para `messageReactionAdd`.
 * Devuelve un manejador para removerlo o disponerlo facilmente.
 */
export const onMessageReactionAdd = (
  listener: ReactionAddListener,
): ReactionAddSubscription => reactionAddHook.on(listener);

/**
 * Registra un listener de unica ejecucion para `messageReactionAdd`.
 * Devuelve un manejador que permite cancelarlo antes de que se dispare.
 */
export const onceMessageReactionAdd = (
  listener: ReactionAddListener,
): ReactionAddSubscription => reactionAddHook.once(listener);

/**
 * Elimina un listener previamente registrado para `messageReactionAdd`.
 * Acepta tanto el listener original como el manejador devuelto por `on`/`once`.
 */
export const offMessageReactionAdd = (
  listener: ReactionAddListener | ReactionAddSubscription,
): void => reactionAddHook.off(listener);

/** Ejecuta todos los listeners registrados propagando los datos originales del evento. */
export const emitMessageReactionAdd = reactionAddHook.emit;

/** Elimina todos los listeners actualmente registrados para `messageReactionAdd`. */
export const clearMessageReactionAddListeners = reactionAddHook.clear;


/** Parametros tipados que Seyfert provee al evento `messageReactionRemove`. */
export type ReactionRemoveListenerArgs =
  ResolveEventParams<"messageReactionRemove">;
export type ReactionRemoveListener = AsyncListener<ReactionRemoveListenerArgs>;
export type ReactionRemoveSubscription =
  HookSubscription;

const reactionRemoveHook = createEventHook<ReactionRemoveListenerArgs>();

/**
 * Registra un listener permanente para `messageReactionRemove`.
 * Devuelve un manejador que permite removerlo facilmente.
 */
export const onMessageReactionRemove = (
  listener: ReactionRemoveListener,
): ReactionRemoveSubscription => reactionRemoveHook.on(listener);

/**
 * Registra un listener de unica ejecucion para `messageReactionRemove`.
 */
export const onceMessageReactionRemove = (
  listener: ReactionRemoveListener,
): ReactionRemoveSubscription => reactionRemoveHook.once(listener);

/**
 * Elimina un listener previamente registrado para `messageReactionRemove`.
 */
export const offMessageReactionRemove = (
  listener: ReactionRemoveListener | ReactionRemoveSubscription,
): void => reactionRemoveHook.off(listener);

/** Ejecuta todos los listeners registrados propagando los datos originales del evento. */
export const emitMessageReactionRemove = reactionRemoveHook.emit;

/** Elimina todos los listeners actualmente registrados para `messageReactionRemove`. */
export const clearMessageReactionRemoveListeners = reactionRemoveHook.clear;


/** Parametros tipados que Seyfert provee al evento `messageReactionRemoveAll`. */
export type ReactionRemoveAllListenerArgs =
  ResolveEventParams<"messageReactionRemoveAll">;
export type ReactionRemoveAllListener =
  AsyncListener<ReactionRemoveAllListenerArgs>;
export type ReactionRemoveAllSubscription =
  HookSubscription;

const reactionRemoveAllHook =
  createEventHook<ReactionRemoveAllListenerArgs>();

/**
 * Registra un listener permanente para `messageReactionRemoveAll`.
 * Devuelve un manejador para removerlo facilmente.
 */
export const onMessageReactionRemoveAll = (
  listener: ReactionRemoveAllListener,
): ReactionRemoveAllSubscription => reactionRemoveAllHook.on(listener);

/**
 * Registra un listener de unica ejecucion para `messageReactionRemoveAll`.
 */
export const onceMessageReactionRemoveAll = (
  listener: ReactionRemoveAllListener,
): ReactionRemoveAllSubscription => reactionRemoveAllHook.once(listener);

/**
 * Elimina un listener previamente registrado para `messageReactionRemoveAll`.
 */
export const offMessageReactionRemoveAll = (
  listener: ReactionRemoveAllListener | ReactionRemoveAllSubscription,
): void => reactionRemoveAllHook.off(listener);

/** Ejecuta todos los listeners registrados propagando los datos originales del evento. */
export const emitMessageReactionRemoveAll = reactionRemoveAllHook.emit;

/** Elimina todos los listeners actualmente registrados para `messageReactionRemoveAll`. */
export const clearMessageReactionRemoveAllListeners =
  reactionRemoveAllHook.clear;


/** Parametros tipados que Seyfert provee al evento `messageReactionRemoveEmoji`. */
export type ReactionRemoveEmojiListenerArgs =
  ResolveEventParams<"messageReactionRemoveEmoji">;
export type ReactionRemoveEmojiListener =
  AsyncListener<ReactionRemoveEmojiListenerArgs>;
export type ReactionRemoveEmojiSubscription =
  HookSubscription;

const reactionRemoveEmojiHook =
  createEventHook<ReactionRemoveEmojiListenerArgs>();

/**
 * Registra un listener permanente para `messageReactionRemoveEmoji`.
 * Devuelve un manejador para removerlo facilmente.
 */
export const onMessageReactionRemoveEmoji = (
  listener: ReactionRemoveEmojiListener,
): ReactionRemoveEmojiSubscription => reactionRemoveEmojiHook.on(listener);

/**
 * Registra un listener de unica ejecucion para `messageReactionRemoveEmoji`.
 */
export const onceMessageReactionRemoveEmoji = (
  listener: ReactionRemoveEmojiListener,
): ReactionRemoveEmojiSubscription => reactionRemoveEmojiHook.once(listener);

/**
 * Elimina un listener previamente registrado para `messageReactionRemoveEmoji`.
 */
export const offMessageReactionRemoveEmoji = (
  listener: ReactionRemoveEmojiListener | ReactionRemoveEmojiSubscription,
): void => reactionRemoveEmojiHook.off(listener);

/** Ejecuta todos los listeners registrados propagando los datos originales del evento. */
export const emitMessageReactionRemoveEmoji = reactionRemoveEmojiHook.emit;

/** Elimina todos los listeners actualmente registrados para `messageReactionRemoveEmoji`. */
export const clearMessageReactionRemoveEmojiListeners =
  reactionRemoveEmojiHook.clear;



