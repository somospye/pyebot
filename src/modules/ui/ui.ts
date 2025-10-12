import { CommandContext, Modal, WebhookMessage } from "seyfert";
import { InteractionCreateBodyRequest } from "seyfert/lib/common";
import {
    createSignals,
    createStateProxy,
    type ReactiveState,
    type SignalMap,
} from "./signals";

export type BuildMessageFn<T extends Record<string, unknown>> =
    (state: ReactiveState<T>, update: () => Promise<void>) => InteractionCreateBodyRequest & { modal?: Modal };

export type SenderFn =
    (msg: InteractionCreateBodyRequest & { modal?: Modal }) => Promise<void | WebhookMessage>;

export class UI<T extends Record<string, unknown>> {
    public readonly state: ReactiveState<T>;
    private readonly signals: SignalMap<T>;
    private builder: BuildMessageFn<T>;
    private sender: SenderFn;
    private readonly update: () => Promise<void>;

    constructor(initial: T, builder: BuildMessageFn<T>, sender: SenderFn) {
        this.builder = builder;
        this.sender = sender;

        this.update = async () => {
            await this.sender(this.build());
        };

        this.signals = createSignals(initial, this.update);

        this.state = createStateProxy(this.signals);
    }

    build(): InteractionCreateBodyRequest {
        return this.builder(this.state, this.update);
    }

    send(): Promise<void | WebhookMessage> {
        return this.sender(this.build());
    }
}

export async function open_modal(ctx: CommandContext, modal: Modal | undefined) {
    if (modal) {
        await ctx.interaction.modal(modal);
    }
}
