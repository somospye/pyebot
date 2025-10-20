import type { GuildCommandContext } from "seyfert";
import {
    ActionRow,
    Declare,
    Embed,
    Modal,
    RoleSelectMenu,
    StringSelectMenu,
    StringSelectOption,
    SubCommand,
    TextInput,
} from "seyfert";
import { Button, UI } from "@/modules/ui";
import { ButtonStyle, MessageFlags, TextInputStyle } from "seyfert/lib/types";
import {
    DEFAULT_MODERATION_ACTIONS,
    clearRoleLimit,
    listRoles,
    saveRoleLimit,
    setRoleOverride,
} from "@/modules/guild-roles";
import type { RoleCommandOverride, RoleLimitRecord } from "@/schemas/guild";
import { type LimitWindow } from "@/schemas/guild";

type DashboardRole = {
    key: string;
    label: string;
    discordRoleId: string | null;
    reach: Record<string, RoleCommandOverride>;
    limits: Record<string, RoleLimitRecord | undefined>;
};

interface DashboardState extends Record<string, unknown> {
    selectedRoleIds: string[];
    focusedAction: string;
    feedback: string | null;
    roles: DashboardRole[];
}


const FEEDBACK_NONE = "Selecciona uno o mas roles para empezar.";

function toDashboardRoles(
  entries: Awaited<ReturnType<typeof listRoles>>,
): DashboardRole[] {
  return entries.map((snapshot) => ({
    key: snapshot.key,
    label: snapshot.label,
    discordRoleId: snapshot.discordRoleId ?? null,
    reach: { ...snapshot.overrides },
    limits: { ...snapshot.limits },
  }));
}

function formatOverrideLabel(override: RoleCommandOverride | undefined): string {
    switch (override) {
        case "allow":
            return "Permitir";
        case "deny":
            return "Denegar";
        default:
            return "Heredar";
    }
}

function secondsToTimeString(totalSeconds: number): string {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(" ");
}



function formatLimit(limit: RoleLimitRecord | undefined): string {
    if (!limit || !Number.isFinite(limit.limit) || limit.limit <= 0) {
        return "Sin limite configurado";
    }

    const count = Math.max(0, Math.floor(limit.limit));
    const windowLabel = limit.window ?  secondsToTimeString(windowToSeconds(limit.window)) : "sin ventana fija";

    return `${count} uso(s) - ${windowLabel}`;
}

function buildRoleSummary(role: DashboardRole): string {
    const lines = DEFAULT_MODERATION_ACTIONS.map((action) => {
        const override = role.reach[action.key] ?? "inherit";
        const limit = role.limits[action.key];
        return `- **${action.label}** -> ${formatOverrideLabel(override)} - ${formatLimit(limit)}`;
    });

    return lines.join("\n");
}

function findRolesByDiscordIds(roleIds: readonly string[], roles: DashboardRole[]): DashboardRole[] {
    const idSet = new Set(roleIds);
    return roles.filter((role) => role.discordRoleId && idSet.has(role.discordRoleId));
}

/**
 * Toma un de ventana que deberia ser normalizada.
 * Si el input es invalido, retorna null.
 */
function normalizeWindowInput(input: string | undefined): LimitWindow | null {
    if (!input) return null;
    const normalized = input.trim().toLowerCase();
    if (!normalized) return null;
    
    // If 0 is provided, treat it as no window
    if (normalized.startsWith("0")) {
        return null;
    }
    // Regex to match valid window inputs like 10m, 1h, 6h, 24h, 7d
    if (! /^(\d)+(m|h|d)$/.test(normalized)) {
        return null;
    }

    return normalized as LimitWindow;
}

function windowToSeconds(window: LimitWindow): number {
    // window it's guaranteed to match the pattern due to the type LimitWindow
    const match = window.match(/^(\d+)(m|h|d)$/) as RegExpMatchArray;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
        case "m":
            return value * 60;
        case "h":
            return value * 60 * 60;
        case "d":
            return value * 60 * 60 * 24;
        default:
            return 3600 ; // This should never happen, but default to 1 hour
    }
}

@Declare({
    name: "dashboard",
    description: "Panel visual para administrar roles moderados",
})
export default class RolesDashboardCommand extends SubCommand {
    async run(ctx: GuildCommandContext) {
        const guildId = ctx.guildId;
        if (!guildId) {
            await ctx.write({
                content: "[!] Este comando solo puede ejecutarse dentro de un servidor.",
            });
            return;
        }

        const fetchRoles = async () => toDashboardRoles(await listRoles(guildId));
        const actions = DEFAULT_MODERATION_ACTIONS;
        const initialRoles = await fetchRoles();

        const ui = new UI<DashboardState>(
            {
                selectedRoleIds: [],
                focusedAction: actions[0]?.key ?? "",
                feedback: initialRoles.length ? FEEDBACK_NONE : "No hay roles configurados todavia.",
                roles: initialRoles,
            },
            (state) => {
                const selectedIds = state.selectedRoleIds;
                const selectedRoles = findRolesByDiscordIds(selectedIds, state.roles);
                const hasSelection = selectedRoles.length > 0;
                const actionKey = state.focusedAction || actions[0]?.key || "";
                const activeAction = actions.find((item) => item.key === actionKey) ?? actions[0];

                const embed = new Embed({
                    title: "Panel de control de roles",
                    color: 0x5865f2,
                    description: [
                        "1. Elige uno o mas roles desde el menu superior.",
                        "2. Selecciona la accion de moderacion que quieres administrar.",
                        "3. Usa los botones para permitir, denegar o ajustar limites de uso.",
                        "",
                        state.feedback ?? FEEDBACK_NONE,
                    ].join("\n"),
                });

                if (state.roles.length) {
                    embed.addFields({
                        name: "Roles configurados",
                        value: state.roles
                            .map((role) =>
                                role.discordRoleId
                                    ? `- ${role.label} (<@&${role.discordRoleId}>)`
                                    : `- ${role.label} (sin rol de Discord asignado)`,
                            )
                            .join("\n"),
                    });
                } else {
                    embed.addFields({
                        name: "Sin configuraciones",
                        value: "Utiliza `/roles set` para registrar un rol administrado antes de usar el panel.",
                    });
                }

                if (selectedRoles.length) {
                    for (const role of selectedRoles) {
                        embed.addFields({
                            name: `${role.label}${role.discordRoleId ? ` - <@&${role.discordRoleId}>` : ""}`,
                            value: buildRoleSummary(role),
                            inline: false,
                        });
                    }
                }

                const roleSelect = new RoleSelectMenu()
                    .setPlaceholder("Selecciona roles a administrar")
                    .setValuesLength({ min: 1, max: 10 })
                    .setDisabled(state.roles.length === 0)
                    .onSelect("roles_dashboard_roles", async (menuCtx) => {
                        await menuCtx.deferUpdate();
                        const values = menuCtx.interaction.values ?? [];
                        const knownRoles = findRolesByDiscordIds(values, state.roles);
                        const missingIds = values.filter(
                            (value) => !knownRoles.some((role) => role.discordRoleId === value),
                        );

                        state.selectedRoleIds = values;

                        if (!values.length) {
                            state.feedback = FEEDBACK_NONE;
                        } else if (missingIds.length) {
                            const mentions = missingIds.map((id) => `<@&${id}>`).join(", ");
                            state.feedback = [
                                "Algunos roles seleccionados no estan configurados en el bot:",
                                mentions,
                                "Usa `/roles set` para vincularlos antes de aplicar cambios.",
                            ].join("\n");
                        } else {
                            state.feedback =
                                values.length === 1
                                    ? "Rol seleccionado listo para editar sus permisos."
                                    : "Roles seleccionados listos para aplicar cambios en lote.";
                        }
                    });

                if (selectedIds.length) {
                    roleSelect.setDefaultRoles(selectedIds);
                }

                const actionSelect = new StringSelectMenu()
                    .setPlaceholder("Accion de moderacion")
                    .setValuesLength({ min: 1, max: 1 })
                    .onSelect("roles_dashboard_action", async (menuCtx) => {
                        await menuCtx.deferUpdate();
                        const value = menuCtx.interaction.values?.[0];
                        if (value) {
                            state.focusedAction = value;
                            state.feedback = `Accion seleccionada: ${actions.find((item) => item.key === value)?.label ?? value}.`;
                        }
                    });

                for (const action of actions) {
                    const option = new StringSelectOption()
                        .setLabel(action.label)
                        .setValue(action.key)
                        .setDescription(`Administrar permisos y limites para ${action.label}`);

                    if (action.key === activeAction?.key) {
                        option.setDefault(true);
                    }

                    actionSelect.addOption(option);
                }

                const controlsDisabled = !hasSelection || !activeAction;

                const applyOverride = (
                    id: string,
                    label: string,
                    style: ButtonStyle,
                    override: RoleCommandOverride,
                ) =>
                    new Button()
                        .setLabel(label)
                        .setStyle(style)
                        .setDisabled(controlsDisabled)
                        .onClick(id, async (buttonCtx) => {
                            const targetRoles = findRolesByDiscordIds(state.selectedRoleIds, state.roles);

                            if (!targetRoles.length || !activeAction) {
                                await buttonCtx.write({
                                    content: "Selecciona al menos un rol y una accion para continuar.",
                                    flags: MessageFlags.Ephemeral,
                                });
                                return;
                            }

                        try {
                            for (const role of targetRoles) {
                                await setRoleOverride(
                                    guildId,
                                    role.key,
                                    activeAction.key,
                                    override,
                                );
                            }

                            state.roles = await fetchRoles();
                            state.feedback = `Override actualizado a ${formatOverrideLabel(override)} para ${targetRoles.length} rol(es) en ${activeAction.label}.`;
                        } catch (error) {
                            console.error("roles dashboard override", error);
                            state.feedback = "No se pudo actualizar el override. Intentalo nuevamente.";
                        }
                    });

                const allowButton = applyOverride(
                    "roles_dashboard_allow",
                    "Permitir",
                    ButtonStyle.Success,
                    "allow",
                );
                const denyButton = applyOverride(
                    "roles_dashboard_deny",
                    "Denegar",
                    ButtonStyle.Danger,
                    "deny",
                );
                const inheritButton = applyOverride(
                    "roles_dashboard_inherit",
                    "Hereda Discord",
                    ButtonStyle.Secondary,
                    "inherit",
                );

                const action = actions.find((item) => item.key === state.focusedAction) ?? actions[0];

                const limitInput = new TextInput()
                    .setCustomId("limit_count")
                    .setLabel("Cantidad maxima de usos")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ejemplo: 5 (usa 0 para quitar el limite)")
                    .setRequired(true);

                const windowInput = new TextInput()
                    .setCustomId("limit_window")
                    .setLabel("Ventana de tiempo")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("10m, 1h, 6h, 24h o 7d. Deja vacio para sin ventana.")
                    .setRequired(false);

                const limitModal = new Modal()
                    .setCustomId("roles_dashboard_limit_modal")
                    .setTitle(`Limite para ${action?.label ?? "accion"}`)
                    .addComponents(
                        new ActionRow<TextInput>().setComponents([limitInput]),
                        new ActionRow<TextInput>().setComponents([windowInput]),
                    )
                    .run(async (modalCtx) => {
                        const refreshedRoles = findRolesByDiscordIds(state.selectedRoleIds, state.roles);
                        const refreshedAction =
                            actions.find((item) => item.key === state.focusedAction) ?? actions[0];

                        if (!refreshedRoles.length || !refreshedAction) {
                            await modalCtx.write({
                                content: "Selecciona al menos un rol y una accion valida antes de configurar limites.",
                                flags: MessageFlags.Ephemeral,
                            });
                            return;
                        }

                        const rawLimit = modalCtx.getInputValue("limit_count") ?? "";
                        const rawWindow = modalCtx.getInputValue("limit_window") ?? "";

                        const limitNumber = Number(rawLimit.trim());
                        if (!Number.isFinite(limitNumber) || limitNumber < 0) {
                            await modalCtx.write({
                                content: "Ingresa un numero valido (0 o mayor) para el limite de usos.",
                                flags: MessageFlags.Ephemeral,
                            });
                            return;
                        }

                        const windowResult = normalizeWindowInput(rawWindow);
                        if (windowResult === null) {
                            await modalCtx.write({
                                content: "Ventana invalida. Usa un formato valido: 10m, 1h, 6h, 24h o 7d.",
                                flags: MessageFlags.Ephemeral,
                            });
                            return;
                        }

                        const window_as_seconds = windowToSeconds(windowResult);

                        try {
                            if (limitNumber === 0) {
                                for (const role of refreshedRoles) {
                                    await clearRoleLimit(
                                        guildId,
                                        role.key,
                                        refreshedAction.key,
                                    );
                                }

                                state.feedback = `Se removieron los limites de ${refreshedAction.label} para ${refreshedRoles.length} rol(es).`;
                            } else {
                                const limitRecord: RoleLimitRecord = {
                                    limit: Math.max(0, Math.floor(limitNumber)),
                                    window: windowResult,
                                    windowSeconds: window_as_seconds,
                                };

                                for (const role of refreshedRoles) {
                                    await saveRoleLimit(
                                        guildId,
                                        role.key,
                                        refreshedAction.key,
                                        limitRecord,
                                    );
                                }

                                state.feedback = `Limite actualizado para ${refreshedAction.label}: ${limitRecord.limit} uso(s) ${limitRecord.window ? secondsToTimeString(limitRecord.windowSeconds as number) : "sin ventana"} (${refreshedRoles.length} rol(es)).`;
                            }

                            state.roles = await fetchRoles();
                            await modalCtx.write({
                                content: "Limite actualizado correctamente.",
                                flags: MessageFlags.Ephemeral,
                            });
                        } catch (error) {
                            console.error("roles dashboard limit", error);
                            state.feedback = "No se pudo guardar el limite. Intentalo nuevamente.";
                            await modalCtx.write({
                                content: "Ocurrio un error al guardar el limite.",
                                flags: MessageFlags.Ephemeral,
                            });
                        }
                    });

                const configureLimitButton = new Button()
                    .setLabel("Configurar limite")
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(controlsDisabled)
                    .opens(limitModal);

                const clearLimitButton = new Button()
                    .setLabel("Quitar limite")
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(controlsDisabled)
                    .onClick("roles_dashboard_clear_limit", async (buttonCtx) => {
                        const targetRoles = findRolesByDiscordIds(state.selectedRoleIds, state.roles);
                        const action = actions.find((item) => item.key === state.focusedAction) ?? actions[0];

                        if (!targetRoles.length || !action) {
                            await buttonCtx.write({
                                content: "Selecciona al menos un rol y una accion para quitar el limite.",
                                flags: MessageFlags.Ephemeral,
                            });
                            return;
                        }

                        try {
                            for (const role of targetRoles) {
                                await clearRoleLimit(guildId, role.key, action.key);
                            }

                            state.roles = await fetchRoles();
                            state.feedback = `Limite eliminado para ${action.label} en ${targetRoles.length} rol(es).`;
                        } catch (error) {
                            console.error("roles dashboard clear limit", error);
                            state.feedback = "No se pudo eliminar el limite. Intentalo nuevamente.";
                        }
                    });

                return {
                    embeds: [embed],
                    components: [
                        new ActionRow().addComponents(roleSelect),
                        new ActionRow().addComponents(actionSelect),
                        new ActionRow().addComponents(allowButton, denyButton, inheritButton, configureLimitButton, clearLimitButton),
                    ],
                };
            },
            async (msg) => {
                await ctx.editOrReply(msg);
            },
        );

        await ui.send();
    }
}


