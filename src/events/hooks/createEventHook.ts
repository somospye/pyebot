/**
 * Utilidades genericas para crear y manipular "hooks" de eventos asincronicos.
 */
export type Awaitable<T> = T | Promise<T>;

/** Firma base de un listener manejado por un hook. */
export type HookListener<TArgs extends readonly unknown[]> = (
  ...args: TArgs
) => Awaitable<void>;

/**
 * API minima para registrar, ejecutar y remover escuchas de un hook.
 */
export type EventHookTuple<TArgs extends readonly unknown[]> = [
  on: (listener: HookListener<TArgs>) => () => void,
  once: (listener: HookListener<TArgs>) => () => void,
  off: (listener: HookListener<TArgs>) => void,
  emit: (...args: TArgs) => Promise<void>,
  clear: () => void,
];

export interface EventHook<TArgs extends readonly unknown[]> {
  /** Registra un listener persistente y devuelve una funcion para desregistrarlo. */
  on(listener: HookListener<TArgs>): () => void;
  /** Registra un listener que se ejecuta una sola vez. */
  once(listener: HookListener<TArgs>): () => void;
  /** Elimina un listener previamente registrado. */
  off(listener: HookListener<TArgs>): void;
  /** Ejecuta los listeners registrados con los argumentos provistos. */
  emit(...args: TArgs): Promise<void>;
  /** Limpia todos los listeners registrados. */
  clear(): void;
  /** Devuelve tuplas con los handlers mas usados preconfigurados. */
  make(): EventHookTuple<TArgs>;
}

/**
 * Factoria de hooks fuertemente tipados que permite orquestar callbacks asincronicos.
 * 
 * Ejemplo de uso (manual):
 * ```ts
 * const messageCreateHook = createEventHook<MessageCreateListenerArgs>();
 * 
 * export const onMessageCreate = (
   listener: MessageCreateListener,
 ): (() => void) => messageCreateHook.on(listener);
 * ```
 * Ejemplo de uso (atajo):
 * ```ts
 * const [ onMessageCreate, offMessageCreate, emitMessageCreate ] = createEventHook<MessageCreateListenerArgs>().make();
 */
export const createEventHook = <TArgs extends readonly unknown[]>(): EventHook<TArgs> => {
  const listeners = new Set<HookListener<TArgs>>();

  const off = (listener: HookListener<TArgs>): void => {
    listeners.delete(listener);
  };

  const on = (listener: HookListener<TArgs>): (() => void) => {
    listeners.add(listener);
    return () => off(listener);
  };

  const once = (listener: HookListener<TArgs>): (() => void) => {
    let wrapped: HookListener<TArgs>;
    wrapped = (async (
      ...args: TArgs
    ): Promise<void> => {
      off(wrapped);
      await listener(...args);
    }) as HookListener<TArgs>;

    listeners.add(wrapped);
    return () => off(wrapped);
  };

  const emit = async (...args: TArgs): Promise<void> => {
    for (const listener of Array.from(listeners)) {
      await listener(...args);
    }
  };

  const clear = (): void => {
    listeners.clear();
  };


  const make = (): EventHookTuple<TArgs> => [on, once, off, emit, clear];

  return { on, once, off, emit, clear, make };
};
