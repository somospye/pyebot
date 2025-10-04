// seyui/src/runtime/ui.ts
import { packRows } from "./layout";
import { button, select, modal } from "./components";
import type { RenderableUI } from "./components";
import { ThemeKey, THEME, type UIOptions } from "./styles";

type ComponentBuilder = { _build(ui: RenderableUI): any };
type EmbedComposerFn = (ui: RenderableUI, composer: EmbedComposer) => void;

type EmbedStep = {
    kind: "embed";
    theme?: ThemeKey;
    composer: EmbedComposerFn;
};

type RowStep = {
    kind: "row";
    items: ComponentBuilder[];
};

type Step = EmbedStep | RowStep;

export type RenderedMessage = {
    content: string;
    embeds: any[];
    components: any[];
};

export type EmbedComposer = {
    title: (text: string) => void;
    description: (value?: string) => void;
    color: (hex: number) => void;
    field: (name: string, value: string, inline?: boolean) => void;
};

export interface UIBuilder extends RenderableUI {
    state: Record<string, unknown>;
    embed(handler: EmbedComposerFn): UIBuilder;
    embed(theme: ThemeKey, handler: EmbedComposerFn): UIBuilder;
    embed(first: ThemeKey | EmbedComposerFn, handler?: EmbedComposerFn): UIBuilder;
    row(...components: ComponentBuilder[]): UIBuilder;
    toMessage(): RenderedMessage;
    page: unknown;
}

/**
 * Factory that produces a fluent UI builder for Discord-style interactive messages.
 *
 * The builder maintains a mutable state bag that is shared with event handlers.
 * After every interaction the UI re-renders itself by calling `__render`.
 */
export function UI(opts: UIOptions = {}): UIBuilder {
    const state = opts.state ?? {};
    const steps: Step[] = [];

    const render = (): RenderedMessage => {
        const { Embed } = require("seyfert");
        const embeds: any[] = [];
        const flatComponents: any[] = [];

        for (const step of steps) {
            if (step.kind === "embed") {
                const embed = new Embed();
                const composer = createEmbedComposer(embed);

                if (step.theme) embed.setColor(THEME.Embed[step.theme]?.color ?? undefined);
                step.composer(api, composer);

                embeds.push(embed.toJSON?.() ?? embed);
                continue;
            }

            for (const item of step.items) {
                if (typeof item?._build === "function") flatComponents.push(item._build(api));
            }
        }

        const components = packRows(flatComponents);

        // Discord rejects messages without textual content, so ship a single space.
        return { content: " ", embeds, components };
    };

    const api: UIBuilder = {
        state,
        embed(first: ThemeKey | EmbedComposerFn, second?: EmbedComposerFn) {
            let theme: ThemeKey | undefined;
            let composer: EmbedComposerFn | undefined;

            if (typeof first === "function") {
                composer = first;
                theme = second as ThemeKey | undefined;
            } else {
                theme = first;
                composer = second;
            }

            steps.push({ kind: "embed", theme, composer: composer as EmbedComposerFn });
            return api;
        },
        row(...components: ComponentBuilder[]) {
            steps.push({ kind: "row", items: components });
            return api;
        },
        toMessage() {
            return render();
        },
        __render: render,
        get page() {
            return (state as Record<string, unknown>).page;
        },
        set page(value: unknown) {
            (state as Record<string, unknown>).page = value;
        },
    };

    return api;
}

function createEmbedComposer(embed: any): EmbedComposer {
    return {
        title: (text) => embed.setTitle(text),
        description: (value) => embed.setDescription(value),
        color: (hex) => embed.setColor(hex),
        field: (name, value, inline) => embed.addFields({ name, value, inline }),
    };
}

export { button, select, modal, ThemeKey };