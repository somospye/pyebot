/**
 * Máquina de estados del panel de roles y utilidades relacionadas.
 *
 * El panel vive únicamente en memoria: cada interacción dura como máximo cinco minutos,
 * refleja el flujo efímero de Discord y sólo toca la base de datos cuando la persona
 * moderadora confirma el resumen final. Este módulo se organiza en cuatro capas
 * conceptuales:
 *
 * 1. Utilidades de persistencia (ciclo de vida de sesiones, clonación, seguimiento de
 *    cambios).
 * 2. Helpers de dominio (cálculo de límites, alcance y resúmenes de cambios).
 * 3. Renderizadores que construyen embeds/componentes para cada pantalla del asistente.
 * 4. Manejadores de acciones que orquestan transiciones y efectos secundarios.
 *
 * Cada capa tiene comentarios en línea para que futuras contribuciones puedan seguir el
 * flujo sin necesidad de reingeniería inversa.
 */

import { randomUUID } from "node:crypto";

import {
  ActionRow,
  Button,
  Embed,
  Modal,
  RoleSelectMenu,
  StringSelectMenu,
  StringSelectOption,
  TextInput,
  type UsingClient,
} from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
import { ButtonStyle, TextInputStyle } from "seyfert/lib/types/payloads/components";

import { DEFAULT_MODERATION_ACTIONS, getGuildRoles, upsertRole } from "../../modules/guild-roles";
import type { GuildDatabase } from "@/modules/guilds/store";
import { parseDuration } from "@/utils/duration";
import type {
  GuildRoleRecord,
  GuildRolesRecord,
  LimitWindow,
  RoleCommandOverride,
  RoleLimitRecord,
} from "@/schemas/guild";

const ORDERED_WINDOWS: readonly LimitWindow[] = [
  "10m",
  "1h",
  "6h",
  "24h",
  "7d",
];

const WINDOW_SECONDS_MAP: Record<LimitWindow, number> = {
  "10m": 10 * 60,
  "1h": 60 * 60,
  "6h": 6 * 60 * 60,
  "24h": 24 * 60 * 60,
  "7d": 7 * 24 * 60 * 60,
};


export type DashboardState =
  | "HOME"
  | "ROLE_MENU"
  | "MAP_DISCORD_ROLE"
  | "LIMITS"
  | "REACH"
  | "CONFIRM_SAVE"
  | "TIMEOUT";

export type DashboardAction =
  | "refresh"
  | "close"
  | "select_role"
  | "back_home"
  | "open_option"
  | "map_select"
  | "map_confirm"
  | "map_clear"
  | "map_cancel"
  | "limits_select_action"
  | "limits_apply"
  | "limits_cancel"
  | "reach_select_command"
  | "reach_select_override"
  | "reach_apply"
  | "reach_cancel"
  | "save_request"
  | "save_confirm"
  | "save_continue"
  | "rename_confirm"
  | "set_limit"
  | "reopen"
  | "noop";

export interface DashboardRender {
  content?: string;
  embeds: Embed[];
  components: ActionRow[];
}

export interface DashboardActionOptions {
  session: DashboardSession;
  action: DashboardAction;
  actorId: string;
  values?: readonly string[];
  data?: Record<string, unknown>;
  database?: GuildDatabase;
}

export interface DashboardActionResult {
  view: DashboardRender;
  notice?: string;
  error?: string;
}

export interface DashboardDispatchOptions {
  session: DashboardSession;
  client: UsingClient;
  view: DashboardRender;
}

type ActionContext = DashboardActionOptions;
type ActionHandler = (context: ActionContext) => Promise<DashboardActionResult> | DashboardActionResult;

const defaultActionHandler: ActionHandler = ({ session }) => ({
  view: renderSession(session),
});

const ACTION_HANDLERS: Record<DashboardAction, ActionHandler> = {
  refresh: handleRefresh,
  close: handleClose,
  select_role: handleSelectRole,
  back_home: handleBackHome,
  open_option: handleOpenOption,
  map_select: handleMapSelect,
  map_confirm: handleMapConfirm,
  map_clear: handleMapClear,
  map_cancel: handleMapCancel,
  limits_select_action: handleLimitsSelect,
  limits_apply: handleLimitsApply,
  limits_cancel: handleLimitsCancel,
  reach_select_command: handleReachSelectCommand,
  reach_select_override: handleReachOverride,
  reach_apply: handleReachApply,
  reach_cancel: handleReachCancel,
  save_request: handleSaveRequest,
  save_confirm: handleSaveConfirm,
  save_continue: handleSaveContinue,
  rename_confirm: handleRenameConfirm,
  set_limit: handleSetLimit,
  reopen: handleReopen,
  noop: defaultActionHandler,
};

export async function handleDashboardAction(
  options: DashboardActionOptions,
): Promise<DashboardActionResult> {
  const { session, action } = options;

  if (session.expired && action !== "reopen" && action !== "close") {
    return {
      view: buildExpiredView(session),
      error: "La sesion ha expirado. Usa Reabrir para continuar.",
    };
  }
  const handler = ACTION_HANDLERS[action] ?? defaultActionHandler;
  return await handler(options);
}

/**
 * Re-syncs the dashboard with the latest database snapshot when there are no dirty drafts.
 */
async function handleRefresh(context: ActionContext): Promise<DashboardActionResult> {
  const { session, database } = context;

  if (session.dirtyKeys.size) {
    return {
      view: renderSession(session),
      error: "Guarda o descarta los cambios pendientes antes de actualizar.",
    };
  }

  const fresh = await adapters.getGuildRoles(session.guildId, database);
  session.original = cloneRoles(fresh);
  session.draft = cloneRoles(fresh);
  session.dirtyKeys.clear();
  session.state = "HOME";
  session.selectedRoleKey = undefined;
  session.stateData = undefined;
  touchSession(session);

  return {
    view: renderSession(session),
    notice: "Lista actualizada.",
  };
}

function encodeView(view: DashboardRender): {
  content?: string | null;
  embeds?: ReturnType<Embed["toJSON"]>[];
  components?: ReturnType<ActionRow["toJSON"]>[];
} {
  return {
    content: view.content ?? null,
    embeds: view.embeds?.map((embed) => embed.toJSON?.() ?? embed),
    components: view.components?.map((row) => row.toJSON?.() ?? row),
  };
}

export async function dispatchViewUpdate({
  session,
  client,
  view,
}: DashboardDispatchOptions): Promise<void> {
  if (!session.applicationId || !session.responseToken) {
    return;
  }

  const payload = encodeView(view);

  await client.interactions.editOriginal(session.responseToken, payload);
}

/**
 * Returns the dashboard to its root state without reloading data.
 */
function handleBackHome(context: ActionContext): DashboardActionResult {
  const { session } = context;
  session.state = "HOME";
  session.selectedRoleKey = undefined;
  session.stateData = undefined;
  touchSession(session);
  return { view: renderSession(session) };
}

/**
 * Tears down an active session and removes component state.
 */
function handleClose(context: ActionContext): DashboardActionResult {
  const { session } = context;
  if (session.timer) {
    clearTimeout(session.timer);
    session.timer = undefined;
  }
  sessions.delete(session.id);
  return { view: buildClosedView() };
}

/**
 * Rehydrates a session that expired due to inactivity by fetching the latest stored roles.
 */
async function handleReopen(context: ActionContext): Promise<DashboardActionResult> {
  const { session, database } = context;
  session.expired = false;
  if (session.timer) {
    clearTimeout(session.timer);
  }

  const fresh = await adapters.getGuildRoles(session.guildId, database);
  session.original = cloneRoles(fresh);
  session.draft = cloneRoles(fresh);
  session.dirtyKeys.clear();
  session.state = "HOME";
  session.selectedRoleKey = undefined;
  session.stateData = undefined;
  touchSession(session);

  return { view: renderSession(session), notice: "Sesion reabierta." };
}

/**
 * Persists the role chosen in the home view and transitions to the detail panel.
 */
function handleSelectRole(context: ActionContext): DashboardActionResult {
  const { session, values } = context;
  const roleKey = values?.[0];

  if (!roleKey) {
    return {
      view: renderSession(session),
      error: "Selecciona un rol valido.",
    };
  }

  session.selectedRoleKey = roleKey;
  ensureDraftRole(session, roleKey);
  session.state = "ROLE_MENU";
  session.stateData = undefined;
  touchSession(session);

  return { view: renderSession(session) };
}

/**
 * Interprets the secondary selector within the role menu and moves the session into the
 * requested sub-screen (map, limits, reach or rename).
 */
function handleOpenOption(context: ActionContext): DashboardActionResult {
  const { session, values } = context;
  const roleKey = session.selectedRoleKey;

  if (!roleKey) {
    session.state = "HOME";
    session.stateData = undefined;
    return { view: buildHomeView(session) };
  }

  const selection = values?.[0];
  const draft = ensureDraftRole(session, roleKey);

  switch (selection) {
    case "map": {
      session.state = "MAP_DISCORD_ROLE";
      session.stateData = {
        type: "MAP",
        previousRoleId: draft.discordRoleId ?? null,
        pendingRoleId: draft.discordRoleId ?? null,
      };
      break;
    }
    case "limits": {
      session.state = "LIMITS";
      session.stateData = {
        type: "LIMITS",
        snapshot: cloneLimits(draft.limits ?? {}),
        lastEditedAction: undefined,
      };
      break;
    }
    case "reach": {
      session.state = "REACH";
      session.stateData = {
        type: "REACH",
        snapshot: { ...(draft.reach ?? {}) },
        selectedCommand: undefined,
      };
      break;
    }
    case "rename": {
      // No state change; the caller will trigger the modal.
      session.state = "ROLE_MENU";
      session.stateData = undefined;
      break;
    }
    default: {
      session.state = "ROLE_MENU";
      session.stateData = undefined;
    }
  }

  touchSession(session);
  return { view: renderSession(session) };
}

/**
 * Tracks the Discord role picked in the map sub-screen without committing it yet.
 */
function handleMapSelect(context: ActionContext): DashboardActionResult {
  const { session, values } = context;
  const state = session.stateData;

  if (state?.type !== "MAP") {
    return { view: renderSession(session) };
  }

  const pending = values && values.length > 0 ? values[0] : null;
  session.stateData = { ...state, pendingRoleId: pending };
  touchSession(session);

  return { view: renderSession(session) };
}

/**
 * Saves the pending Discord role mapping into the draft role.
 */
function handleMapConfirm(context: ActionContext): DashboardActionResult {
  const { session } = context;
  const roleKey = session.selectedRoleKey;
  const state = session.stateData;

  if (!roleKey || state?.type !== "MAP") {
    return { view: renderSession(session) };
  }

  const draft = ensureDraftRole(session, roleKey);
  draft.discordRoleId = state.pendingRoleId ?? null;
  syncDirtyFlag(session, roleKey);

  session.state = "ROLE_MENU";
  session.stateData = undefined;
  touchSession(session);

  return {
    view: renderSession(session),
    notice: "Asignacion actualizada.",
  };
}

/**
 * Clears the temporary Discord role selection while staying within the map flow.
 */
function handleMapClear(context: ActionContext): DashboardActionResult {
  const { session } = context;
  const state = session.stateData;

  if (state?.type !== "MAP") {
    return { view: renderSession(session) };
  }

  session.stateData = {
    ...state,
    pendingRoleId: null,
  };
  touchSession(session);

  return { view: renderSession(session) };
}

/**
 * Cancels the mapping flow and returns to the role summary without applying changes.
 */
function handleMapCancel(context: ActionContext): DashboardActionResult {
  const { session } = context;
  const roleKey = session.selectedRoleKey;
  const state = session.stateData;

  if (!roleKey || state?.type !== "MAP") {
    return { view: renderSession(session) };
  }

  session.state = "ROLE_MENU";
  session.stateData = undefined;
  touchSession(session);

  return { view: renderSession(session) };
}

/**
 * Stores the action the moderator intends to edit inside the limits modal flow.
 */
function handleLimitsSelect(context: ActionContext): DashboardActionResult {
  const { session, values } = context;
  const state = session.stateData;

  if (state?.type !== "LIMITS") {
    return { view: renderSession(session) };
  }

  const action = values?.[0];
  if (action) {
    session.stateData = { ...state, lastEditedAction: action };
  }

  touchSession(session);
  return { view: renderSession(session) };
}

/**
 * Persists the tentative limits after the modal is confirmed.
 */
function handleLimitsApply(context: ActionContext): DashboardActionResult {
  const { session } = context;
  const roleKey = session.selectedRoleKey;

  session.state = "ROLE_MENU";
  session.stateData = undefined;
  if (roleKey) {
    syncDirtyFlag(session, roleKey);
  }
  touchSession(session);

  return { view: renderSession(session), notice: "Limites actualizados." };
}

/**
 * Restores the previous limits when the moderator cancels the modal.
 */
function handleLimitsCancel(context: ActionContext): DashboardActionResult {
  const { session } = context;
  const roleKey = session.selectedRoleKey;
  const state = session.stateData;

  if (roleKey && state?.type === "LIMITS") {
    const draft = ensureDraftRole(session, roleKey);
    draft.limits = cloneLimits(state.snapshot ?? {});
    syncDirtyFlag(session, roleKey);
  }

  session.state = "ROLE_MENU";
  session.stateData = undefined;
  touchSession(session);

  return { view: renderSession(session) };
}

/**
 * Keeps track of the command currently highlighted in the reach configuration list.
 */
function handleReachSelectCommand(context: ActionContext): DashboardActionResult {
  const { session, values } = context;
  const state = session.stateData;

  if (state?.type !== "REACH") {
    return { view: renderSession(session) };
  }

  const command = values?.[0];
  session.stateData = { ...state, selectedCommand: command };
  touchSession(session);

  return { view: renderSession(session) };
}

/**
 * Applies a reach override to the draft role without leaving the configuration view.
 */
function handleReachOverride(context: ActionContext): DashboardActionResult {
  const { session, values } = context;
  const roleKey = session.selectedRoleKey;
  const state = session.stateData;

  if (!roleKey || state?.type !== "REACH") {
    return { view: renderSession(session) };
  }

  const selectedCommand = state.selectedCommand;
  const desired = values?.[0] as RoleCommandOverride | undefined;

  if (!selectedCommand || !desired) {
    return {
      view: renderSession(session),
      error: "Selecciona un comando y un estado valido.",
    };
  }

  const draft = ensureDraftRole(session, roleKey);

  if (desired === "inherit") {
    delete draft.reach[selectedCommand];
  } else {
    draft.reach[selectedCommand] = desired;
  }

  session.stateData = { ...state, selectedCommand };
  syncDirtyFlag(session, roleKey);
  touchSession(session);

  return { view: renderSession(session) };
}

/**
 * Confirms the reach overrides, marking the session as dirty if needed.
 */
function handleReachApply(context: ActionContext): DashboardActionResult {
  const { session } = context;
  const roleKey = session.selectedRoleKey;

  session.state = "ROLE_MENU";
  session.stateData = undefined;
  if (roleKey) syncDirtyFlag(session, roleKey);
  touchSession(session);

  return { view: renderSession(session), notice: "Alcance actualizado." };
}

/**
 * Discards temporary reach overrides and returns to the role overview.
 */
function handleReachCancel(context: ActionContext): DashboardActionResult {
  const { session } = context;
  const roleKey = session.selectedRoleKey;
  const state = session.stateData;

  if (roleKey && state?.type === "REACH") {
    const draft = ensureDraftRole(session, roleKey);
    draft.reach = { ...(state.snapshot ?? {}) };
    syncDirtyFlag(session, roleKey);
  }

  session.state = "ROLE_MENU";
  session.stateData = undefined;
  touchSession(session);

  return { view: renderSession(session) };
}

/**
 * Shows the confirmation screen with a diff of pending changes.
 */
function handleSaveRequest(context: ActionContext): DashboardActionResult {
  const { session } = context;

  if (!session.dirtyKeys.size) {
    return {
      view: renderSession(session),
      error: "No hay cambios pendientes por guardar.",
    };
  }

  const summary = buildSavePreview(session);
  session.state = "CONFIRM_SAVE";
  session.stateData = { type: "CONFIRM_SAVE", summary };
  touchSession(session);

  return { view: renderSession(session) };
}

/**
 * Returns to the role summary when the moderator wants to keep editing.
 */
function handleSaveContinue(context: ActionContext): DashboardActionResult {
  const { session } = context;
  session.state = "ROLE_MENU";
  session.stateData = undefined;
  touchSession(session);

  return { view: renderSession(session) };
}

/**
 * Persists all dirty draft roles and refreshes the local snapshot.
 */
async function handleSaveConfirm(context: ActionContext): Promise<DashboardActionResult> {
  const { session, database } = context;
  const guildId = session.guildId;

  if (!session.dirtyKeys.size) {
    return {
      view: renderSession(session),
      error: "No hay cambios para guardar.",
    };
  }

  for (const roleKey of session.dirtyKeys) {
    const draft = session.draft[roleKey];
    if (!draft) continue;

    const { record } = await adapters.upsertRole(
      guildId,
      {
        key: roleKey,
        label: draft.label,
        discordRoleId: draft.discordRoleId ?? null,
        limits: draft.limits,
        reach: draft.reach,
        updatedBy: session.moderatorId,
      },
      database,
    );

    const persisted = cloneRole(record);
    session.draft[roleKey] = persisted;
    session.original[roleKey] = cloneRole(persisted);
  }

  session.dirtyKeys.clear();
  session.state = "ROLE_MENU";
  session.stateData = undefined;
  touchSession(session);

  return {
    view: renderSession(session),
    notice: "Cambios guardados correctamente.",
  };
}

/**
 * Validates and stores the new internal label entered through the rename modal.
 */
function handleRenameConfirm(context: ActionContext): DashboardActionResult {
  const { session, data } = context;
  const roleKey = session.selectedRoleKey;
  if (!roleKey) {
    return { view: renderSession(session) };
  }

  const labelInput = typeof data?.label === "string" ? data.label.trim() : "";
  if (!labelInput) {
    return {
      view: renderSession(session),
      error: "El nombre no puede estar vacio.",
    };
  }
  if (labelInput.length > 32) {
    return {
      view: renderSession(session),
      error: "El nombre debe tener 32 caracteres o menos.",
    };
  }

  const draft = ensureDraftRole(session, roleKey);
  draft.label = labelInput;
  syncDirtyFlag(session, roleKey);
  touchSession(session);

  return { view: renderSession(session), notice: "Nombre actualizado." };
}

/**
 * Updates a single limit entry after the moderator submits the modal.
 */
function handleSetLimit(context: ActionContext): DashboardActionResult {
  const { session, data } = context;
  const roleKey = session.selectedRoleKey;
  const state = session.stateData;

  if (!roleKey || state?.type !== "LIMITS") {
    return { view: renderSession(session) };
  }

  const actionKey = typeof data?.actionKey === "string" ? data.actionKey.trim() : "";
  if (!actionKey) {
    return {
      view: renderSession(session),
      error: "Selecciona una accion valida.",
    };
  }

  const limitValueRaw = data?.limitValue;
  const limitValue = Number(limitValueRaw);
  if (!Number.isFinite(limitValue) || limitValue < 0) {
    return {
      view: renderSession(session),
      error: "El limite debe ser un numero entero mayor o igual a 0.",
    };
  }

  const windowInput = typeof data?.windowValue === "string" ? data.windowValue : "";
  let limitRecord: RoleLimitRecord;

  if (limitValue === 0) {
    limitRecord = { limit: 0, window: null, windowSeconds: null };
  } else {
    const parsedWindow = parseWindowInput(windowInput);
    if (!parsedWindow || !parsedWindow.windowSeconds) {
      return {
        view: renderSession(session),
        error: "Ventana de tiempo invalida.",
      };
    }

    limitRecord = {
      limit: Math.floor(limitValue),
      window: parsedWindow.window,
      windowSeconds: parsedWindow.windowSeconds,
    };
  }

  const draft = ensureDraftRole(session, roleKey);
  draft.limits[actionKey] = limitRecord;
  syncDirtyFlag(session, roleKey);

  session.stateData = {
    type: "LIMITS",
    snapshot: state.snapshot,
    lastEditedAction: actionKey,
  };

  touchSession(session);

  return { view: renderSession(session), notice: "Limite actualizado." };
}







export function renderSession(session: DashboardSession): DashboardRender {
  switch (session.state) {
    case "HOME":
      return buildHomeView(session);
    case "ROLE_MENU":
      return buildRoleMenuView(session);
    case "MAP_DISCORD_ROLE":
      return buildMapView(session);
    case "LIMITS":
      return buildLimitsView(session);
    case "REACH":
      return buildReachView(session);
    case "CONFIRM_SAVE":
      return buildConfirmView(session);
    case "TIMEOUT":
      return buildExpiredView(session);
    default:
      return buildHomeView(session);
  }
}

/**
 * Landing screen listing every managed role with a quick selector.
 */
function buildHomeView(session: DashboardSession): DashboardRender {
  const embed = new Embed({
    title: "Panel de Roles",
    description: "Selecciona un rol para configurar limites y alcance.",
    color: EmbedColors.Blurple,
  });

  const entries = Object.entries(session.draft).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  const lines = entries.map(([roleKey, record]) => {
    const mention = record.discordRoleId
      ? `<@&${record.discordRoleId}>`
      : "Sin asignar";
    const dirty = session.dirtyKeys.has(roleKey) ? " ✳️" : "";
    return `• ${record.label || roleKey} (${roleKey}) → ${mention}${dirty}`;
  });

  embed.addFields({
    name: "Roles administrados",
    value: lines.length ? lines.join("\n") : "No hay configuraciones registradas.",
  });

  const select = new StringSelectMenu()
    .setCustomId(makeCustomId(session, "select_role"))
    .setPlaceholder("Selecciona un rol");

  const roleOptions = entries.slice(0, 25).map(([roleKey, record]) =>
    new StringSelectOption()
      .setLabel((record.label || roleKey).slice(0, 100))
      .setValue(roleKey)
      .setDescription(
        record.discordRoleId ? "ID: " + record.discordRoleId : "Sin rol vinculado",
      ),
  );

  if (roleOptions.length) {
    select.setOptions(roleOptions);
  } else {
    select.setDisabled(true);
  }

  const selectRow = new ActionRow<StringSelectMenu>().setComponents([select]);

  const refreshButton = new Button()
    .setCustomId(makeCustomId(session, "refresh"))
    .setLabel("Actualizar lista")
    .setStyle(ButtonStyle.Secondary);

  const closeButton = new Button()
    .setCustomId(makeCustomId(session, "close"))
    .setLabel("Cerrar")
    .setStyle(ButtonStyle.Danger);

  const buttonRow = new ActionRow<Button>().setComponents([refreshButton, closeButton]);

  return {
    embeds: [embed],
    components: roleOptions.length ? [selectRow, buttonRow] : [buttonRow],
  };
}

/**
 * Main edit hub for a single role showing status of limits and reach overrides.
 */
function buildRoleMenuView(session: DashboardSession): DashboardRender {
  const roleKey = session.selectedRoleKey;
  if (!roleKey) {
    session.state = "HOME";
    return buildHomeView(session);
  }

  const draft = ensureDraftRole(session, roleKey);
  const original = session.original[roleKey];

  const limits = summariseLimits(draft);
  const reach = summariseReach(draft);

  const embed = new Embed({
    title: `Configuracion de ${draft.label || roleKey}`,
    color: EmbedColors.Blurple,
  });

  embed.setDescription(
    [`**Clave:** ${roleKey}`, `**Rol de Discord:** ${draft.discordRoleId ? `<@&${draft.discordRoleId}>` : "Sin asignar"}`].join("\n"),
  );

  embed.addFields(
    {
      name: "Limites",
      value: limits.lines.join("\n"),
    },
    {
      name: "Alcance",
      value: `allow: ${reach.allow} · deny: ${reach.deny} · inherit: ${reach.inherit}`,
    },
  );

  if (session.dirtyKeys.has(roleKey)) {
    embed.setFooter({ text: "Cambios pendientes sin guardar" });
  } else if (!original) {
    embed.setFooter({ text: "Nuevo registro" });
  }

  const optionSelect = new StringSelectMenu()
    .setCustomId(makeCustomId(session, "open_option"))
    .setPlaceholder("Accion rapida");

  optionSelect.setOptions([
    new StringSelectOption().setLabel("Renombrar rol interno").setValue("rename"),
    new StringSelectOption().setLabel("Apuntar a rol de Discord").setValue("map"),
    new StringSelectOption().setLabel("Limites de uso").setValue("limits"),
    new StringSelectOption().setLabel("Alcance de comandos").setValue("reach"),
  ]);

  const optionRow = new ActionRow<StringSelectMenu>().setComponents([optionSelect]);

  const backButton = new Button()
    .setCustomId(makeCustomId(session, "back_home"))
    .setLabel("Volver")
    .setStyle(ButtonStyle.Secondary);

  const saveButton = new Button()
    .setCustomId(makeCustomId(session, "save_request"))
    .setLabel("Guardar cambios")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!session.dirtyKeys.size);

  const closeButton = new Button()
    .setCustomId(makeCustomId(session, "close"))
    .setLabel("Cerrar")
    .setStyle(ButtonStyle.Danger);

  const buttons = new ActionRow<Button>().setComponents([backButton, saveButton, closeButton]);

  return {
    embeds: [embed],
    components: [optionRow, buttons],
  };
}

/**
 * UI that lets moderators associate the internal slot with an actual Discord role.
 */
function buildMapView(session: DashboardSession): DashboardRender {
  const roleKey = session.selectedRoleKey;
  const draft = roleKey ? ensureDraftRole(session, roleKey) : undefined;
  const state = session.stateData?.type === "MAP" ? session.stateData : undefined;

  const embed = new Embed({
    title: `Mapear rol interno`,
    description: "Selecciona un rol de Discord o deja sin asignar.",
    color: EmbedColors.Blurple,
  });

  embed.addFields({
    name: "Rol actual",
    value: draft?.discordRoleId ? `<@&${draft.discordRoleId}>` : "Sin asignar",
  });

  const select = new RoleSelectMenu()
    .setCustomId(makeCustomId(session, "map_select"))
    .setValuesLength({ min: 0, max: 1 });

  if (state?.pendingRoleId) {
    select.setDefaultRoles(state.pendingRoleId);
  } else if (draft?.discordRoleId) {
    select.setDefaultRoles(draft.discordRoleId);
  }

  const selectRow = new ActionRow<RoleSelectMenu>().setComponents([select]);

  const confirmButton = new Button()
    .setCustomId(makeCustomId(session, "map_confirm"))
    .setLabel("Confirmar")
    .setStyle(ButtonStyle.Primary);

  const clearButton = new Button()
    .setCustomId(makeCustomId(session, "map_clear"))
    .setLabel("Sin asignar")
    .setStyle(ButtonStyle.Secondary);

  const cancelButton = new Button()
    .setCustomId(makeCustomId(session, "map_cancel"))
    .setLabel("Cancelar")
    .setStyle(ButtonStyle.Danger);

  const buttonRow = new ActionRow<Button>().setComponents([
    confirmButton,
    clearButton,
    cancelButton,
  ]);

  return {
    embeds: [embed],
    components: [selectRow, buttonRow],
  };
}

/**
 * Limits configuration table with per-action summaries.
 */
function buildLimitsView(session: DashboardSession): DashboardRender {
  const roleKey = session.selectedRoleKey;
  const draft = roleKey ? ensureDraftRole(session, roleKey) : undefined;
  const embed = new Embed({
    title: `Limites de ${draft?.label ?? roleKey}`,
    description: "Configura cuantos usos se permiten en cada ventana.",
    color: EmbedColors.Blurple,
  });

  if (!draft) {
    return buildHomeView(session);
  }

  const limitsSummary = summariseLimits(draft);
  embed.addFields({
    name: "Limites",
    value: limitsSummary.lines.join("\n"),
  });

  const availableActions = new Set<string>([
    ...DEFAULT_MODERATION_ACTIONS.map((action) => action.key),
    ...Object.keys(draft.limits ?? {}),
  ]);

  const select = new StringSelectMenu()
    .setCustomId(makeCustomId(session, "limits_select_action"))
    .setPlaceholder("Elegir accion a editar");

  const options = Array.from(availableActions)
    .sort((a, b) => a.localeCompare(b))
    .map((action) =>
      new StringSelectOption()
        .setLabel(action.slice(0, 100))
        .setValue(action)
        .setDescription(
          draft.limits?.[action]
            ? `${draft.limits[action]!.limit} usos / ${formatDuration(
                toWindowSeconds(draft.limits[action]!) ?? 0,
              )}`
            : "Sin limite",
        ),
    );

  if (options.length) {
    select.setOptions(options);
  } else {
    select.setDisabled(true);
  }

  const selectRow = new ActionRow<StringSelectMenu>().setComponents([select]);

  const applyButton = new Button()
    .setCustomId(makeCustomId(session, "limits_apply"))
    .setLabel("Aplicar")
    .setStyle(ButtonStyle.Primary);

  const cancelButton = new Button()
    .setCustomId(makeCustomId(session, "limits_cancel"))
    .setLabel("Cancelar")
    .setStyle(ButtonStyle.Danger);

  const buttonRow = new ActionRow<Button>().setComponents([applyButton, cancelButton]);

  return {
    embeds: [embed],
    components: options.length ? [selectRow, buttonRow] : [buttonRow],
  };
}

/**
 * Reach override view listing commands and their explicit state.
 */
function buildReachView(session: DashboardSession): DashboardRender {
  const roleKey = session.selectedRoleKey;
  const draft = roleKey ? ensureDraftRole(session, roleKey) : undefined;
  const state = session.stateData?.type === "REACH" ? session.stateData : undefined;

  if (!draft) {
    return buildHomeView(session);
  }

  const embed = new Embed({
    title: `Alcance de ${draft.label || roleKey}`,
    description: "Define para cada comando si el rol puede usarlo.",
    color: EmbedColors.Blurple,
  });

  const reachSummary = summariseReach(draft);
  embed.addFields({
    name: "Resumen",
    value: `allow: ${reachSummary.allow} · deny: ${reachSummary.deny} · inherit: ${reachSummary.inherit}`,
  });

  const commands = new Set<string>([
    ...DEFAULT_MODERATION_ACTIONS.map((action) => action.key),
    ...Object.keys(draft.reach ?? {}),
  ]);

  const commandSelect = new StringSelectMenu()
    .setCustomId(makeCustomId(session, "reach_select_command"))
    .setPlaceholder("Comando a ajustar")
    .setValuesLength({ min: 1, max: 1 });

  const commandOptions = Array.from(commands)
    .sort((a, b) => a.localeCompare(b))
    .map((command) =>
      new StringSelectOption()
        .setLabel(command.slice(0, 100))
        .setValue(command)
        .setDescription(`Estado actual: ${draft.reach?.[command] ?? "inherit"}`)
        .setDefault(state?.selectedCommand === command),
    );

  if (commandOptions.length) {
    commandSelect.setOptions(commandOptions);
  } else {
    commandSelect.setDisabled(true);
  }

  const commandRow = new ActionRow<StringSelectMenu>().setComponents([commandSelect]);

  const overrideSelect = new StringSelectMenu()
    .setCustomId(makeCustomId(session, "reach_select_override"))
    .setPlaceholder("Selecciona permiso")
    .setValuesLength({ min: 1, max: 1 })
    .setDisabled(!state?.selectedCommand);

  overrideSelect.setOptions([
    new StringSelectOption().setLabel("Heredar").setValue("inherit"),
    new StringSelectOption().setLabel("Permitir").setValue("allow"),
    new StringSelectOption().setLabel("Denegar").setValue("deny"),
  ]);

  const overrideRow = new ActionRow<StringSelectMenu>().setComponents([overrideSelect]);

  const applyButton = new Button()
    .setCustomId(makeCustomId(session, "reach_apply"))
    .setLabel("Aplicar")
    .setStyle(ButtonStyle.Primary);

  const cancelButton = new Button()
    .setCustomId(makeCustomId(session, "reach_cancel"))
    .setLabel("Cancelar")
    .setStyle(ButtonStyle.Danger);

  const buttonsRow = new ActionRow<Button>().setComponents([applyButton, cancelButton]);

  return {
    embeds: [embed],
    components: commandOptions.length
      ? [commandRow, overrideRow, buttonsRow]
      : [buttonsRow],
  };
}

/**
 * Confirmation screen enumerating every change grouped by role.
 */
function buildConfirmView(session: DashboardSession): DashboardRender {
  const preview = session.stateData?.type === "CONFIRM_SAVE"
    ? session.stateData.summary
    : buildSavePreview(session);

  const embed = new Embed({
    title: "Resumen de cambios",
    color: EmbedColors.Gold,
  });

  if (!preview.roles.length) {
    embed.setDescription("No hay cambios pendientes.");
  } else {
    const lines = preview.roles.map((role) => {
      const parts: string[] = [];
      if (role.labelChanged) {
        parts.push(
          `• Nombre: ${role.labelChanged.before} → ${role.labelChanged.after}`,
        );
      }
      if (role.mappingChanged) {
        parts.push(
          `• Rol Discord: ${role.mappingChanged.before ?? "Sin asignar"} → ${role.mappingChanged.after ?? "Sin asignar"}`,
        );
      }
      if (role.limits.length) {
        const limitLines = role.limits
          .map((limit) => {
            const before = limit.before
              ? `${limit.before.limit}/${formatDuration(
                  toWindowSeconds(limit.before) ?? 0,
                )}`
              : "sin limite";
            const after = limit.after
              ? `${limit.after.limit}/${formatDuration(
                  toWindowSeconds(limit.after) ?? 0,
                )}`
              : "sin limite";
            return `   - ${limit.action}: ${before} → ${after}`;
          })
          .join("\n");
        parts.push(limitLines);
      }
      if (role.reach.length) {
        const reachLines = role.reach
          .map(
            (change) =>
              `   - ${change.action}: ${change.before} → ${change.after}`,
          )
          .join("\n");
        parts.push(reachLines);
      }

      return [`**${role.roleKey}**`, ...parts].join("\n");
    });

    embed.setDescription(lines.join("\n\n"));
  }

  const confirmButton = new Button()
    .setCustomId(makeCustomId(session, "save_confirm"))
    .setLabel("Confirmar guardado")
    .setStyle(ButtonStyle.Success)
    .setDisabled(!preview.roles.length);

  const continueButton = new Button()
    .setCustomId(makeCustomId(session, "save_continue"))
    .setLabel("Seguir editando")
    .setStyle(ButtonStyle.Secondary);

  const buttonsRow = new ActionRow<Button>().setComponents([
    confirmButton,
    continueButton,
  ]);

  return {
    embeds: [embed],
    components: [buttonsRow],
  };
}

/**
 * Simple prompt shown once the session timer elapses.
 */
function buildExpiredView(session: DashboardSession): DashboardRender {
  const embed = new Embed({
    title: "Sesion expirada",
    description: "Pasaron mas de 5 minutos sin actividad.",
    color: EmbedColors.Red,
  });

  const reopenButton = new Button()
    .setCustomId(makeCustomId(session, "reopen"))
    .setLabel("Reabrir")
    .setStyle(ButtonStyle.Primary);

  const buttonRow = new ActionRow<Button>().setComponents([reopenButton]);

  return {
    embeds: [embed],
    components: [buttonRow],
  };
}

/**
 * Farewell message when the moderator explicitly closes the panel.
 */
function buildClosedView(): DashboardRender {
  const embed = new Embed({
    title: "Panel cerrado",
    description: "Puedes volver a ejecutar /roles dashboard cuando lo necesites.",
    color: EmbedColors.Greyple,
  });

  return {
    embeds: [embed],
    components: [],
  };
}

/**
 * Creates the modal used to rename the internal label of the role.
 */
export function buildRenameModal(session: DashboardSession): Modal {
  const roleKey = session.selectedRoleKey;
  const draft = roleKey ? session.draft[roleKey] : undefined;

  const modal = new Modal()
    .setCustomId(makeCustomId(session, "rename_confirm"))
    .setTitle("Renombrar rol interno");

  const input = new TextInput()
    .setCustomId("label")
    .setStyle(TextInputStyle.Short)
    .setLabel("Nombre visible")
    .setRequired(true)
    .setLength({ min: 1, max: 32 })
    .setValue(draft?.label ?? "");

  const row = new ActionRow<TextInput>().addComponents(input);
  modal.addComponents(row);

  return modal;
}

/**
 * Builds the modal that captures a single limit entry (uses and optional window).
 */
export function buildLimitModal(
  session: DashboardSession,
  actionKey: string,
): Modal {
  const roleKey = session.selectedRoleKey;
  const draft = roleKey ? session.draft[roleKey] : undefined;
  const current = draft?.limits?.[actionKey];

  const modal = new Modal()
    .setCustomId(makeCustomId(session, "set_limit", actionKey))
    .setTitle(`Limite para ${actionKey}`);

  const usesInput = new TextInput()
    .setCustomId("limitValue")
    .setStyle(TextInputStyle.Short)
    .setLabel("Usos permitidos (0 = deshabilitado)")
    .setRequired(true)
    .setPlaceholder("Ejemplo: 3")
    .setLength({ min: 1, max: 4 })
    .setValue(current ? String(current.limit) : "0");

  const windowInput = new TextInput()
    .setCustomId("windowValue")
    .setStyle(TextInputStyle.Short)
    .setLabel("Ventana de tiempo (10m, 1h, 24h...)")
    .setRequired(false)
    .setPlaceholder("Ejemplo: 24h")
    .setValue(
      current && current.limit > 0
        ? current.window ?? `${toWindowSeconds(current) ?? 0}s`
        : "",
    );

  const actionRow = new ActionRow<TextInput>().addComponents(usesInput);
  const windowRow = new ActionRow<TextInput>().addComponents(windowInput);

  modal.setComponents([actionRow, windowRow]);

  return modal;
}


export interface DashboardSession {
  readonly id: string;
  readonly guildId: string;
  readonly moderatorId: string;
  state: DashboardState;
  selectedRoleKey?: string;
  original: GuildRolesRecord;
  draft: GuildRolesRecord;
  dirtyKeys: Set<string>;
  stateData?: DashboardStateData;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  expired: boolean;
  timer?: NodeJS.Timeout;
  applicationId?: string;
  responseToken?: string;
  messageId?: string | null;
}

const SESSION_TTL_MS = 5 * 60 * 1_000;

const sessions = new Map<string, DashboardSession>();

interface DashboardAdapters {
  getGuildRoles: typeof getGuildRoles;
  upsertRole: typeof upsertRole;
}

const adapters: DashboardAdapters = {
  getGuildRoles,
  upsertRole,
};

/**
 * Allows tests to replace persistence primitives with in-memory doubles.
 */
export function setDashboardAdapters(overrides: Partial<DashboardAdapters>): void {
  if (overrides.getGuildRoles) adapters.getGuildRoles = overrides.getGuildRoles;
  if (overrides.upsertRole) adapters.upsertRole = overrides.upsertRole;
}

/**
 * Encodes the session identifier and target action into a Discord customId.
 */
function makeCustomId(
  session: DashboardSession,
  action: string,
  extra?: string,
): string {
  const safeAction = encodeURIComponent(action);
  const base = `rolesDash:${session.id}:${safeAction}`;
  return extra ? `${base}:${encodeURIComponent(extra)}` : base;
}

type DashboardStateData =
  | { type: "MAP"; previousRoleId: string | null; pendingRoleId: string | null }
  | { type: "LIMITS"; snapshot: GuildRoleRecord["limits"]; lastEditedAction?: string }
  | { type: "REACH"; snapshot: Record<string, RoleCommandOverride>; selectedCommand?: string }
  | { type: "CONFIRM_SAVE"; summary: SavePreview }
  | undefined;

/**
 * Creates a fresh dashboard session for the moderator and schedules inactivity timeout.
 */
export function createSession({
  guildId,
  moderatorId,
  roles,
}: {
  guildId: string;
  moderatorId: string;
  roles: GuildRolesRecord;
}): DashboardSession {
  const now = Date.now();
  const session: DashboardSession = {
    id: randomUUID(),
    guildId,
    moderatorId,
    state: "HOME",
    original: cloneRoles(roles),
    draft: cloneRoles(roles),
    dirtyKeys: new Set(),
    createdAt: now,
    updatedAt: now,
    expiresAt: now + SESSION_TTL_MS,
    expired: false,
    timer: undefined,
  };

  session.timer = setTimeout(() => expireSession(session.id), SESSION_TTL_MS);

  sessions.set(session.id, session);
  return session;
}

export function getSession(sessionId: string): DashboardSession | undefined {
  return sessions.get(sessionId);
}

/**
 * Marks a session as expired and cancels its timers. Reopen will rebuild the state.
 */
export function expireSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  if (session.timer) {
    clearTimeout(session.timer);
    session.timer = undefined;
  }

  session.expired = true;
  session.state = "TIMEOUT";
}

/**
 * Extends a session lifetime in response to any moderator interaction.
 */
export function touchSession(session: DashboardSession): void {
  const now = Date.now();
  session.updatedAt = now;
  session.expiresAt = now + SESSION_TTL_MS;
  if (session.timer) {
    clearTimeout(session.timer);
  }
  session.timer = setTimeout(() => expireSession(session.id), SESSION_TTL_MS);
}

/**
 * Deep clones the persisted roles map to keep session mutations isolated.
 */
function cloneRoles(source: GuildRolesRecord): GuildRolesRecord {
  const clone: GuildRolesRecord = {};

  for (const [key, record] of Object.entries(source)) {
    clone[key] = cloneRole(record);
  }

  return clone;
}

/**
 * Clones a single role configuration including limits and reach overrides.
 */
function cloneRole(record: GuildRoleRecord): GuildRoleRecord {
  return {
    label: record.label,
    discordRoleId: record.discordRoleId ?? null,
    limits: cloneLimits(record.limits ?? {}),
    reach: { ...(record.reach ?? {}) },
    updatedBy: record.updatedBy ?? null,
    updatedAt: record.updatedAt ?? null,
  };
}

/**
 * Produces a safe copy of the limits dictionary so drafts can diverge.
 */
function cloneLimits(
  source: GuildRoleRecord["limits"],
): GuildRoleRecord["limits"] {
  const limits: GuildRoleRecord["limits"] = {};

  for (const [action, limit] of Object.entries(source ?? {})) {
    if (!limit) continue;

    limits[action] = {
      limit: limit.limit,
      window: limit.window ?? null,
      windowSeconds: limit.windowSeconds ?? null,
    };
  }

  return limits;
}

/**
 * Converts a limit record into seconds, preferring the explicit windowSeconds property.
 */
export function toWindowSeconds(limit: RoleLimitRecord | undefined): number | null {
  if (!limit) return null;

  if (
    typeof limit.windowSeconds === "number" &&
    Number.isFinite(limit.windowSeconds) &&
    limit.windowSeconds > 0
  ) {
    return Math.floor(limit.windowSeconds);
  }

  if (!limit.window) return null;

  return WINDOW_SECONDS_MAP[limit.window] ?? null;
}

/**
 * Compares two limit dictionaries ignoring object identity.
 */
export function areLimitsEqual(
  a: GuildRoleRecord["limits"] | undefined,
  b: GuildRoleRecord["limits"] | undefined,
): boolean {
  const mapA = a ?? {};
  const mapB = b ?? {};
  const keys = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);

  for (const key of keys) {
    const limitA = mapA[key];
    const limitB = mapB[key];

    if (!limitA && !limitB) continue;
    if (!limitA || !limitB) return false;

    if (limitA.limit !== limitB.limit) return false;
    if (limitA.window !== limitB.window) return false;
    if (toWindowSeconds(limitA) !== toWindowSeconds(limitB)) return false;
  }

  return true;
}

function isSameLimit(
  a: RoleLimitRecord | undefined,
  b: RoleLimitRecord | undefined,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;

  if (a.limit !== b.limit) return false;
  if ((a.window ?? null) !== (b.window ?? null)) return false;
  if (toWindowSeconds(a) !== toWindowSeconds(b)) return false;

  return true;
}

/**
 * Compares reach dictionaries while normalising undefined overrides to "inherit".
 */
export function areReachMapsEqual(
  a: Record<string, RoleCommandOverride> | undefined,
  b: Record<string, RoleCommandOverride> | undefined,
): boolean {
  const mapA = a ?? {};
  const mapB = b ?? {};
  const keys = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);

  for (const key of keys) {
    if ((mapA[key] ?? "inherit") !== (mapB[key] ?? "inherit")) {
      return false;
    }
  }

  return true;
}

/**
 * Reports whether the draft diverges from the stored copy.
 */
export function isRoleDirty(
  original: GuildRoleRecord | undefined,
  draft: GuildRoleRecord,
): boolean {
  if (!original) {
    return true;
  }

  if (draft.label !== original.label) return true;
  if ((draft.discordRoleId ?? null) !== (original.discordRoleId ?? null)) return true;
  if (!areLimitsEqual(original.limits, draft.limits)) return true;
  if (!areReachMapsEqual(original.reach, draft.reach)) return true;

  return false;
}

/**
 * Adds or removes the role key from the dirty set depending on the current diff.
 */
export function syncDirtyFlag(
  session: DashboardSession,
  roleKey: string,
): void {
  const original = session.original[roleKey];
  const draft = session.draft[roleKey];

  if (!draft) {
    session.dirtyKeys.delete(roleKey);
    return;
  }

  if (isRoleDirty(original, draft)) {
    session.dirtyKeys.add(roleKey);
  } else {
    session.dirtyKeys.delete(roleKey);
  }
}

/**
 * Makes sure the draft map contains a mutable entry for the requested role.
 */
export function ensureDraftRole(
  session: DashboardSession,
  roleKey: string,
): GuildRoleRecord {
  if (!session.draft[roleKey]) {
    const source = session.original[roleKey];
    session.draft[roleKey] = source ? cloneRole(source) : createEmptyRole();
  }

  return session.draft[roleKey]!;
}

/**
 * Creates a blank role record used when the moderator introduces a brand new mapping.
 */
function createEmptyRole(): GuildRoleRecord {
  return {
    label: "",
    discordRoleId: null,
    limits: {},
    reach: {},
    updatedBy: null,
    updatedAt: null,
  };
}

export function resetDraftRole(
  session: DashboardSession,
  roleKey: string,
): void {
  const original = session.original[roleKey];
  if (!original) {
    delete session.draft[roleKey];
    session.dirtyKeys.delete(roleKey);
    return;
  }

  session.draft[roleKey] = cloneRole(original);
  syncDirtyFlag(session, roleKey);
}

export interface LimitSummary {
  lines: string[];
  total: number;
}

/**
 * Generates a textual summary used in the role overview embed.
 */
export function summariseLimits(record: GuildRoleRecord): LimitSummary {
  const limits = record.limits ?? {};
  const actions = Object.keys(limits);

  if (actions.length === 0) {
    return { lines: ["Sin limites configurados"], total: 0 };
  }

  const lines = actions
    .sort((a, b) => a.localeCompare(b))
    .map((action) => {
      const limit = limits[action];
      if (!limit || limit.limit <= 0) {
        return `• ${action}: deshabilitado`;
      }
      const windowSeconds = toWindowSeconds(limit);
      const windowLabel = windowSeconds ? formatDuration(windowSeconds) : "sin ventana";
      return `• ${action}: ${limit.limit} usos / ${windowLabel}`;
    });

  return { lines, total: actions.length };
}

export interface ReachSummary {
  allow: number;
  deny: number;
  inherit: number;
}

/**
 * Counts overrides by type (allow/deny/inherit) for display purposes.
 */
export function summariseReach(record: GuildRoleRecord): ReachSummary {
  const reach = record.reach ?? {};
  const commands = new Set<string>([
    ...DEFAULT_MODERATION_ACTIONS.map((action) => action.key),
    ...Object.keys(reach),
  ]);

  let allow = 0;
  let deny = 0;
  let inherit = 0;

  for (const command of commands) {
    const value = reach[command] ?? "inherit";
    if (value === "allow") allow += 1;
    else if (value === "deny") deny += 1;
    else inherit += 1;
  }

  return { allow, deny, inherit };
}

/**
 * Converts a number of seconds into a compact human readable string.
 */
function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "sin ventana";

  const parts: string[] = [];
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);

  if (!parts.length) {
    parts.push(`${seconds % 60}s`);
  }

  return parts.join(" ");
}

/**
 * Picks the nearest symbolic window (10m, 1h...) for a given amount of seconds.
 */
function resolveWindowFromSeconds(seconds: number): LimitWindow {
  for (const window of ORDERED_WINDOWS) {
    const maxSeconds = WINDOW_SECONDS_MAP[window];
    if (seconds <= maxSeconds) {
      return window;
    }
  }
  return ORDERED_WINDOWS[ORDERED_WINDOWS.length - 1] ?? "24h";
}

/**
 * Normalises user input from the modal into a window spec understood by the backend.
 */
function parseWindowInput(
  input: string,
): { window: LimitWindow | null; windowSeconds: number | null } | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return { window: null, windowSeconds: null };
  }

  const normalized = trimmed.toLowerCase();
  if (normalized in WINDOW_SECONDS_MAP) {
    const win = normalized as LimitWindow;
    return { window: win, windowSeconds: WINDOW_SECONDS_MAP[win] };
  }

  const seconds = parseDuration(trimmed);
  if (seconds === null || seconds <= 0) {
    return null;
  }

  const window = resolveWindowFromSeconds(seconds);
  return { window, windowSeconds: seconds };
}

export interface LimitChange {
  action: string;
  before?: RoleLimitRecord;
  after?: RoleLimitRecord;
}

export interface ReachChange {
  action: string;
  before: RoleCommandOverride;
  after: RoleCommandOverride;
}

export interface RoleChangeSummary {
  roleKey: string;
  labelChanged?: { before: string; after: string };
  mappingChanged?: { before: string | null; after: string | null };
  limits: LimitChange[];
  reach: ReachChange[];
}

export interface SavePreview {
  roles: RoleChangeSummary[];
  totalRoles: number;
}

/**
 * Produces the summary shown before saving so moderators can confirm deltas.
 */
export function buildSavePreview(session: DashboardSession): SavePreview {
  const roles: RoleChangeSummary[] = [];

  for (const roleKey of session.dirtyKeys) {
    const original = session.original[roleKey];
    const draft = session.draft[roleKey];
    if (!draft) continue;

    const summary: RoleChangeSummary = {
      roleKey,
      limits: [],
      reach: [],
    };

    if (!original || original.label !== draft.label) {
      summary.labelChanged = {
        before: original?.label ?? "(nuevo)",
        after: draft.label,
      };
    }

    if ((original?.discordRoleId ?? null) !== (draft.discordRoleId ?? null)) {
      summary.mappingChanged = {
        before: original?.discordRoleId ?? null,
        after: draft.discordRoleId ?? null,
      };
    }

    const limitKeys = new Set([
      ...Object.keys(original?.limits ?? {}),
      ...Object.keys(draft.limits ?? {}),
    ]);

    for (const action of limitKeys) {
      const before = original?.limits?.[action];
      const after = draft.limits?.[action];
      if (isSameLimit(before ?? undefined, after ?? undefined)) continue;

      summary.limits.push({ action, before: before ?? undefined, after: after ?? undefined });
    }

    const reachKeys = new Set([
      ...Object.keys(original?.reach ?? {}),
      ...Object.keys(draft.reach ?? {}),
    ]);

    for (const action of reachKeys) {
      const before = original?.reach?.[action] ?? "inherit";
      const after = draft.reach?.[action] ?? "inherit";
      if (before === after) continue;
      summary.reach.push({ action, before, after });
    }

    roles.push(summary);
  }

  return {
    roles,
    totalRoles: roles.length,
  };
}
