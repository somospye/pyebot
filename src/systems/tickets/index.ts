import { getGuildChannels } from "@/modules/guild-channels";
import { addOpenTicket, listOpenTickets, setPendingTickets } from "@/modules/repo";
import { Colors } from "@/modules/ui/colors";
import {
  ActionRow,
  Button,
  Embed,
  Modal,
  StringSelectMenu,
  StringSelectOption,
  TextInput,
  type UsingClient,
} from "seyfert";
import {
  ButtonStyle,
  ChannelType,
  MessageFlags,
  TextInputStyle,
} from "seyfert/lib/types";


export const TICKET_SELECT_CUSTOM_ID = "tickets:category";
export const TICKET_MODAL_PREFIX = "tickets:modal";
export const TICKET_DETAILS_INPUT_ID = "ticket_details";

// Format {PREFIX}:{ChannelId} to uniquely identify the ticket to close
export const TICKET_CLOSE_BUTTON_ID = "tickets:close";
export const MAX_TICKETS_PER_USER = 1;

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
  const guilds = await client.guilds.list();

  for (const guildId of guilds.map((g) => g.id)) {
    const channels = await getGuildChannels(guildId);
    const ticketChannel = channels.core.tickets;

    const channelId = ticketChannel?.channelId;
    if (!channelId) {
      client.logger?.warn?.("[tickets] no `tickets` channel; skipping.");
      continue;
    }

    // Individually delete leftovers
    const remaining = await client.messages
      .list(channelId, { limit: 100 })
      .catch(() => {
        console.error("[tickets] failed to list messages for channel", {
          channelId,
        });
        return [];
      });
    const botId = client.me?.id ?? null;
    for (const m of remaining) {
      const hasTicketComponent =
        Array.isArray(m.components) &&
        m.components.some((row: any) =>
          Array.isArray(row?.components) &&
          row.components.some(
            (component: any) =>
              typeof component?.customId === "string" &&
              component.customId.startsWith(TICKET_SELECT_CUSTOM_ID),
          ),
        );

      if (botId && m.author?.id !== botId && !hasTicketComponent) {
        continue;
      }

      try {
        await client.messages.delete(m.id, channelId);
      } catch {
        console.error("[tickets] failed to delete message", {
          messageId: m.id,
          channelId,
        });
      }
    }

    // Recreate ticket message
    const payload = buildTicketMessagePayload();
    await client.messages.write(channelId, payload);
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

      /* Cuando se envia el modal -- creacion de ticket */
      .run(async (ctx) => {
        const content = ctx.getInputValue(TICKET_DETAILS_INPUT_ID, true);
        const guildId = ctx.guildId;
        const userId = ctx.user?.id;

        if (!guildId) {
          await ctx.write({
            content:
              "No se pudo crear el ticket porque no pudimos detectar el servidor.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (!userId) {
          await ctx.write({
            content: "No pudimos identificar tu usuario. Intentalo nuevamente.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const openTickets = await listOpenTickets(userId);
        if (openTickets.length >= MAX_TICKETS_PER_USER) {
          await ctx.write({
            content:
              "Ya tienes un ticket abierto. Cierra el anterior antes de crear uno nuevo.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const channels = await getGuildChannels(guildId);
        const ticketCategoryId =
          channels.core?.ticketCategory?.channelId ?? null;

        if (!ticketCategoryId) {
          await ctx.write({
            content:
              "No hay una categoria configurada para tickets. Avisale a un administrador.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const channelName = buildTicketChannelName(ctx.user?.username);

        let ticketChannel;
        try {
          ticketChannel = await ctx.client.guilds.channels.create(guildId, {
            name: channelName,
            type: ChannelType.GuildText,
            parent_id: ticketCategoryId,
          });
        } catch (error) {
          ctx.client.logger?.error?.("[tickets] failed to create ticket channel", {
            error,
            guildId,
            userId: ctx.user?.id,
          });
          await ctx.write({
            content:
              "Ocurrio un error al crear tu ticket. Intentalo nuevamente en unos segundos.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Marcar el ticket como abierto en la base de datos
        await setPendingTickets(guildId, (pending) => {
          return [...pending, ticketChannel.id];
        });
        await addOpenTicket(userId, ticketChannel.id);

        const welcomeEmbed = new Embed()
          .setColor(Colors.info)
          .setTitle(`Ticket - ${category.label}`)
          .setDescription(
              "Por favor, agrega toda la informacion relevante a tu solicitud mientras esperas..."
          )
          .setFooter({
            text: `Creado por ${ctx.user?.username || "???"}`,
          });

        const reasonEmbed = new Embed()
          .setColor(Colors.info)
          .setTitle("Razon del Ticket")
          .setDescription(content);

        const row = new ActionRow<Button>().addComponents(
          new Button()
            .setCustomId(TICKET_CLOSE_BUTTON_ID + ":" + ticketChannel.id)
            .setLabel("Cerrar Ticket")
            .setStyle(ButtonStyle.Danger) // Discord no admite botones naranja; Danger es lo más cercano.
        );

        await ctx.client.messages.write(ticketChannel.id, {
          embeds: [welcomeEmbed],
          allowed_mentions: {
            parse: [] as ("roles" | "users" | "everyone")[],
          },
        });

        await ctx.client.messages.write(ticketChannel.id, {
          embeds: [reasonEmbed],
          components: [row],
          allowed_mentions: {
            parse: [] as ("roles" | "users" | "everyone")[],
          },
        });

        await ctx.write({
          content: `✅ Gracias! Tu ticket fue enviado: <#${ticketChannel.id}>`,
          flags: MessageFlags.Ephemeral,
        });
      })
  );
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
      text: `Los tickets NO son para soporte técnico. Usa uno de los foros públicos para eso.`,
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
export function getTicketCategory(
  categoryId: string,
): TicketCategory | undefined {
  return TICKET_CATEGORIES.find((category) => category.id === categoryId);
}

function buildTicketChannelName(username: string | undefined): string {
  const base = (username ?? "usuario").normalize("NFD");
  const sanitized = base
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

  const suffix = sanitized || "usuario";
  return `reporte-${suffix}`.slice(0, 100);
}
