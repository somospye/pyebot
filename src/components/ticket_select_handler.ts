import { ComponentCommand, type ComponentContext } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";

import {
  buildTicketModal,
  getTicketCategory,
  TICKET_SELECT_CUSTOM_ID,
} from "@/systems/tickets";

export default class TicketSelectHandler extends ComponentCommand {
  componentType = "StringSelect" as const;
  customId = TICKET_SELECT_CUSTOM_ID;

  async run(ctx: ComponentContext<"StringSelect">) {
    const selection = ctx.interaction.values?.[0];
    if (!selection) {
      await ctx.write({
        content: "Selecciona una opción válida para continuar.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const category = getTicketCategory(selection);
    if (!category) {
      await ctx.write({
        content: "La opción seleccionada ya no está disponible.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const modal = buildTicketModal(category);
    await ctx.interaction.modal(modal);
  }
}
