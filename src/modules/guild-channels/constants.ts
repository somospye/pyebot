export type CoreChannelName =
  | "messageLogs"
  | "voiceLogs"
  | "ticketLogs"
  | "tickets"
  | "ticketCategory"
  | "pointsLog"
  | "generalLogs"
  | "banSanctions"
  | "staff"
  | "suggestions";


export interface CoreChannelDefinition {
  name: CoreChannelName;
  label: string;
}

/**
 * Catalogo central de canales obligatorios: alinea la configuracion en DB
 * con los identificadores fijos definidos en CHANNELS_ID.
 */
export const CORE_CHANNEL_DEFINITIONS: readonly CoreChannelDefinition[] = [
  {
    name: "messageLogs",
    label: "Registro de mensajes moderados",
  },
  {
    name: "voiceLogs",
    label: "Registro de actividad en voz",
  },
  {
    name: "ticketLogs",
    label: "Seguimiento de tickets",
  },
  {
    name: "tickets",
    label: "Canal de tickets",
  },
  {
    name: "ticketCategory",
    label: "Categoría de tickets",
  },
  {
    name: "pointsLog",
    label: "Log de puntos",
  },
  {
    name: "generalLogs",
    label: "Eventos generales del servidor",
  },
  {
    name: "banSanctions",
    label: "Historial de sanciones",
  },
  {
    name: "staff",
    label: "Alertas para el staff",
  },
  {
    name: "suggestions",
    label: "Sugerencias",
  },
] as const;

/** Acceso rapido a la etiqueta humana que se muestra en embeds/logs. */
export const CORE_CHANNEL_LABELS: Record<CoreChannelName, string> =
  Object.fromEntries(
    CORE_CHANNEL_DEFINITIONS.map((definition) => [
      definition.name,
      definition.label,
    ]),
  ) as Record<CoreChannelName, string>;
