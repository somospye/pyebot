/**
 * Lightweight signal implementation with a proxy-based facade to expose plain field access.
 * Extracted from ui.ts to keep the UI wrapper focused on orchestration logic.
 */
export class Signal<T> {
    private value: T;
    private onChange?: () => Promise<void>;

    constructor(value: T, onChange?: () => Promise<void>) {
        this.value = value;
        this.onChange = onChange;
    }

    get(): T {
        return this.value;
    }

    async set(next: T) {
        this.value = next;
        if (this.onChange) await this.onChange();
    }

    async notify() {
        if (this.onChange) await this.onChange();
    }
}

export type SignalMap<T extends Record<string, unknown>> = {
    [K in keyof T]: Signal<T[K]>;
};

export type ReactiveState<T extends Record<string, unknown>> = {
    readonly $: SignalMap<T>;
} & {
    [K in keyof T]: T[K];
};

const isSignalKey = <T extends Record<string, unknown>>(
    signals: SignalMap<T>,
    prop: PropertyKey,
): prop is keyof T =>
    typeof prop === "string" && Object.prototype.hasOwnProperty.call(signals, prop);

export function createSignals<T extends Record<string, unknown>>(
    initial: T,
    onChange: () => Promise<void>,
): SignalMap<T> {
    return Object.fromEntries(
        Object.keys(initial).map(key => [key, new Signal((initial as any)[key], onChange)]),
    ) as SignalMap<T>;
}

export function createStateProxy<T extends Record<string, unknown>>(
    signals: SignalMap<T>,
): ReactiveState<T> {
    const base = Object.create(null) as { $: SignalMap<T> };

    Object.defineProperty(base, "$", {
        value: signals,
        enumerable: false,
        configurable: false,
        writable: false,
    });

    const handler: ProxyHandler<typeof base> = {
        get(target, prop, receiver) {
            if (prop === "$") return signals;
            if (prop === Symbol.toStringTag) return "ReactiveState";
            if (isSignalKey(signals, prop)) {
                const key = prop as keyof T;
                return signals[key].get();
            }
            return Reflect.get(target, prop, receiver);
        },
        set(target, prop, value) {
            if (prop === "$") {
                throw new Error("Cannot overwrite the signal registry.");
            }
            if (isSignalKey(signals, prop)) {
                const key = prop as keyof T;
                void signals[key].set(value as T[keyof T]);
                return true;
            }
            return Reflect.set(target, prop, value);
        },
        has(target, prop) {
            return prop === "$" || isSignalKey(signals, prop) || Reflect.has(target, prop);
        },
        ownKeys(target) {
            const keys = new Set<string | symbol>(Reflect.ownKeys(target) as Array<string | symbol>);
            for (const key of Object.keys(signals)) {
                keys.add(key);
            }
            return Array.from(keys);
        },
        getOwnPropertyDescriptor(target, prop) {
            if (prop === "$") {
                return {
                    configurable: false,
                    enumerable: false,
                    value: signals,
                    writable: false,
                };
            }
            if (isSignalKey(signals, prop)) {
                const key = prop as keyof T;
                return {
                    configurable: true,
                    enumerable: true,
                    get() {
                        return signals[key].get();
                    },
                    set(next: T[keyof T]) {
                        void signals[key].set(next);
                    },
                };
            }
            return Reflect.getOwnPropertyDescriptor(target, prop);
        },
    };

    return new Proxy(base, handler) as ReactiveState<T>;
}
