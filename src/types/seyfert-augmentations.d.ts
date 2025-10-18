
import type { ComponentContext } from "seyfert";
import type {
    StringSelectMenu,
    UserSelectMenu,
    RoleSelectMenu,
    ChannelSelectMenu,
    MentionableSelectMenu,
    GuildForumTagSelectMenu,
    SelectMenu,
    Button,
    Modal,
} from "seyfert";

declare module "seyfert" {
    interface Button {
        /**
         * Attach a click handler; `name` is user-facing and turned into an internal ID.
         * ! CAN'T BE USED WITH opens()
         */
        onClick(
            name: string,
            handler: (ctx: ComponentContext<"Button">) => unknown | Promise<unknown>,
            defer?: boolean
        ): this;

        /**
         * Attach a click handler that opens a modal, then runs an optional callback.
         * ! CAN'T BE USED WITH onClick()
         */
        opens(
            modal: Modal,
            callback?: () => unknown | Promise<unknown>,
        ): this;
    }

    // Precise per-select ctx so menu_ctx is narrowed correctly.
    interface StringSelectMenu {
        onSelect(
            name: string,
            handler: (ctx: ComponentContext<"StringSelect">) => unknown | Promise<unknown>
        ): this;
    }
    interface UserSelectMenu {
        onSelect(
            name: string,
            handler: (ctx: ComponentContext<"UserSelect">) => unknown | Promise<unknown>
        ): this;
    }
    interface RoleSelectMenu {
        onSelect(
            name: string,
            handler: (ctx: ComponentContext<"RoleSelect">) => unknown | Promise<unknown>
        ): this;
    }
    interface ChannelSelectMenu {
        onSelect(
            name: string,
            handler: (ctx: ComponentContext<"ChannelSelect">) => unknown | Promise<unknown>
        ): this;
    }
    interface MentionableSelectMenu {
        onSelect(
            name: string,
            handler: (ctx: ComponentContext<"MentionableSelect">) => unknown | Promise<unknown>
        ): this;
    }
    interface GuildForumTagSelectMenu {
        onSelect(
            name: string,
            handler: (ctx: ComponentContext<"GuildForumTagSelect">) => unknown | Promise<unknown>
        ): this;
    }

    // Fallback for the base class if someone uses it directly.
    interface SelectMenu {
        onSelect(
            name: string,
            handler: (
                ctx:
                    | ComponentContext<"StringSelect">
                    | ComponentContext<"UserSelect">
                    | ComponentContext<"RoleSelect">
                    | ComponentContext<"ChannelSelect">
                    | ComponentContext<"MentionableSelect">
                    | ComponentContext<"GuildForumTagSelect">
            ) => unknown | Promise<unknown>
        ): this;
    }
}
