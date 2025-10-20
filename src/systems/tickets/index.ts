import {
  ActionRow,
  Embed,
  Modal,
  StringSelectMenu,
  StringSelectOption,
  TextInput,
  type UsingClient,
} from "seyfert";
import { MessageFlags, TextInputStyle } from "seyfert/lib/types";

import { get_data_api, toGuildId } from "@/modules/flat_api";

export const TICKET_SELECT_CUSTOM_ID = "tickets:category";
export const TICKET_MODAL_PREFIX = "tickets:modal";
export const TICKET_DETAILS_INPUT_ID = "ticket_details";
const PROGRAMMERS_PLACEHOLDER = "<#000000000000000000>";

export interface TicketCategory {
  id: string;
  label: string;
  description: string;
  emoji: string;
}

export const TICKET_CATEGORIES: readonly TicketCategory[] = [
  {
    id: "report",
    label: "Reportar",
    description: "Denunciar mal comportamiento de otros usuarios.",
    emoji: "\u2757",
  },
  {
    id: "featured",
    label: "Aviso Destacado",
    description: "Compra o consulta por publicidad en el servidor.",
    emoji: "\uD83D\uDCE3",
  },
  {
    id: "workshop",
    label: "Quiero dar un Taller",
    description: "Quieres dar un taller en el servidor?",
    emoji: "\uD83C\uDF93",
  },
  {
    id: "alliance",
    label: "Solicitar alianza de servidor",
    description: "Minimo 300 usuarios y debe cumplir la ToS de Discord.",
    emoji: "\uD83E\uDD1D",
  },
  {
    id: "general",
    label: "General",
    description: "Si ninguna de las opciones anteriores aplica.",
    emoji: "\u2754",
  },
] as const;

/**
 * Ensures that the ticket message exists in the designated channel.
 * If the message does not exist, it will be created.
 * If there are stale messages, they will be deleted.
 * @param client The Discord client instance.
 */
export async function ensureTicketMessage(client: UsingClient): Promise<void> {
  const data = get_data_api();
  const guilds = await client.guilds.list();

  for (const guildId of guilds.map((g) => g.id)) {
    const resolvedGuildId = toGuildId(guildId);
    const channels = await data.getGuildChannels(resolvedGuildId);
    const ticketChannel = channels.core.tickets;

    const channelId = ticketChannel?.channelId;
    if (!channelId) {
      client.logger?.warn?.("[tickets] no `tickets` channel; skipping.");
      continue;
    }

    // Individually delete leftovers
    const remaining = await client.messages
      .list(channelId, { limit: 100 })
      .catch(() => []);
    for (const m of remaining) {
      try {
        await client.messages.delete(m.id, channelId);
      } catch {
        /* meh */
      }
    }

    // Recreate ticket message
    const payload = buildTicketMessagePayload();
    const msg = await client.messages.write(channelId, payload);

    await data.setGuildTicketMessage(resolvedGuildId, msg.id);

    client.logger?.info?.("[tickets] ticket message reset", {
      channelId,
      msgId: msg.id,
    });
  }
}

export function buildTicketModal(category: TicketCategory): Modal {
  return (
    new Modal()
      .setCustomId(`${TICKET_MODAL_PREFIX}:${category.id}`)
      .setTitle(`Ticket: ${category.label}`)
      .addComponents(
        new ActionRow<TextInput>().addComponents(
          new TextInput()
            .setCustomId(TICKET_DETAILS_INPUT_ID)
            .setLabel("Describe tu solicitud")
            .setPlaceholder(
              "Incluye contexto, enlaces o evidencias que consideres necesarias.",
            )
            .setRequired(true)
            .setLength({ min: 8, max: 1000 })
            .setStyle(TextInputStyle.Paragraph),
        ),
      )

      /* Cuando se envía el modal -- creacion de ticket */
      .run(async (ctx) => {
        const content = ctx.getInputValue(TICKET_DETAILS_INPUT_ID, true);
        console.debug("[tickets] createTicket", {
          guildId: ctx.guildId,
          userId: ctx.user?.id,
          category: category.id,
          content,
        });

        // discord category channel -- here tickets will be created
        // const ticket_category = await data.guilds.channels.getCore(ctx.guildId as GuildId, "")

        await ctx.write({
          content: "✅ Gracias! Tu ticket fue enviado.",
          flags: MessageFlags.Ephemeral,
        });
      })
  );
}

export function getTicketCategory(
  categoryId: string,
): TicketCategory | undefined {
  return TICKET_CATEGORIES.find((category) => category.id === categoryId);
}

function buildTicketMessagePayload() {
  const embed = new Embed()
    .setColor("Blurple")
    .setTitle("Gestión de tickets")
    .setDescription(
      [
        "# Elije el tipo de ticket a abrir",
        "",
        "Abajo puedes elegir el tipo de ticket que deseas abrir para hablar con los administradores.",
      ].join("\n"),
    )
    .setFooter({
      text: `Para consultas de programacion utiliza: ${PROGRAMMERS_PLACEHOLDER}`,
    });

  const menu = new StringSelectMenu()
    .setCustomId(TICKET_SELECT_CUSTOM_ID)
    .setPlaceholder("Selecciona el tipo de ticket")
    .setValuesLength({ min: 1, max: 1 });

  for (const category of TICKET_CATEGORIES) {
    menu.addOption(
      new StringSelectOption()
        .setLabel(category.label)
        .setDescription(category.description)
        .setEmoji(category.emoji)
        .setValue(category.id),
    );
  }

  const row = new ActionRow().addComponents(menu);

  return {
    embeds: [embed],
    components: [row],
    allowed_mentions: { parse: [] as ("roles" | "users" | "everyone")[] },
  };
}
