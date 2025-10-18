import type { CommandContext } from "seyfert";
import { ActionRow, Declare, Embed, SubCommand } from "seyfert";
import { Button, UI } from "@/modules/ui";
import { ButtonStyle } from "seyfert/lib/types";

const pages = [
    ["Axe", "Pickaxe", "Sword", "Shovel", "Hoe", "Bow", "Shield", "Trident", "Crossbow", "Fishing Rod"],
    ["Apple", "Bread", "Carrot", "Potato", "Cooked Beef", "Cooked Chicken", "Cooked Mutton", "Cooked Porkchop", "Cooked Rabbit", "Cake"],
    ["Oak Log", "Spruce Log", "Birch Log", "Jungle Log", "Acacia Log", "Dark Oak Log", "Crimson Stem", "Warped Stem", "Stripped Oak Log", "Stripped Spruce Log"],
];

@Declare({
    name: "button",
    description: "Comando de pruebas (raw), hace cualquier cosa",
})
export default class UIButtonTest extends SubCommand {
    async run(ctx: CommandContext) {
        await new UI<{ current_page: number }>(
            { current_page: 0 },
            (state, _update) => {
                const currentPage = state.current_page;

                const embed = new Embed({ title: "# ?? Tienda", color: 0x5865f2 });

                if (pages.length > 0) {
                    const items = pages[currentPage] ?? [];
                    embed.setFields(
                        items.map((item, index) => ({
                            name: `Item: \`${index}\``,
                            value: item,
                            inline: true,
                        })),
                    );
                } else {
                    embed.setDescription("No hay items en esta pagina.");
                    embed.setColor(0xff0000);
                }

                const prev = new Button()
                    .setLabel("⬅️")
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 0)
                    .onClick("prev_page", () => {
                        if (state.current_page > 0) {
                            state.current_page -= 1;
                        }
                    });

                const next = new Button()
                    .setLabel("➡️")
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage >= pages.length - 1)
                    .onClick("next_page", () => {
                        if (state.current_page < pages.length - 1) {
                            state.current_page += 1;
                        }
                    });

                const row = new ActionRow().addComponents(prev, next);
                return { embeds: [embed], components: [row] };
            },
            async (msg) => {
                await ctx.editOrReply(msg);
            },
        ).send();
    }
}
