import type { GuildCommandContext } from "seyfert";
import {
  createBooleanOption,
  createStringOption,
  Declare,
  Embed,
  Options,
  SubCommand,
} from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
import {
  DEFAULT_MODERATION_ACTIONS,
  type RoleCommandOverride,
} from "@/modules/guild-roles";
import {
  requireGuildContext,
  resolveActionInput,
  type ResolvedAction,
} from "./shared";

const OVERRIDE_CHOICES: ReadonlyArray<{
  name: string;
  value: RoleCommandOverride;
}> = [
  { name: "Hereda (Discord)", value: "inherit" },
  { name: "Permitir", value: "allow" },
  { name: "Denegar", value: "deny" },
];

const OPTIONS_FOOTER =
  "inherit respeta Discord, allow fuerza permiso, deny bloquea la accion";

const options = {
  key: createStringOption({
    description: "Clave del rol administrado",
    required: true,
  }),
  action: createStringOption({
    description: "Accion de moderacion (kick, ban, warn, timeout, purge)",
    required: false,
  }),
  override: createStringOption({
    description: "Override a aplicar (inherit, allow, deny)",
    required: false,
    choices: OVERRIDE_CHOICES.map(({ name, value }) => ({ name, value })),
  }),
  reset: createBooleanOption({
    description: "Reiniciar todos los overrides a inherit",
    required: false,
  }),
};

function normalizeOverride(
  value: string | undefined,
): RoleCommandOverride | undefined {
  if (!value) return undefined;

  const normalized = value.toLowerCase();
  if (
    normalized === "allow" ||
    normalized === "deny" ||
    normalized === "inherit"
  ) {
    return normalized;
  }

  return undefined;
}

function formatOverrideList(
  overrides: Record<string, RoleCommandOverride>,
): string {
  const entries = Object.entries(overrides);
  if (entries.length === 0) {
    return "Todos heredan permisos de Discord.";
  }

  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([action, override]) => `- **${action}** -> ${override}`)
    .join("\n");
}

function formatInheritList(
  overrides: Record<string, RoleCommandOverride>,
): string {
  const knownActions = DEFAULT_MODERATION_ACTIONS.map((action) => action.key);
  const inherit = knownActions
    .filter((action) => overrides[action] === undefined)
    .sort();

  if (inherit.length === 0) {
    return "Sin acciones conocidas en modo inherit.";
  }

  return inherit.map((action) => `- ${action}`).join("\n");
}

function formatRoleMention(roleId: string | null): string {
  return roleId ? `<@&${roleId}>` : "Sin asignar";
}

function buildSummaryDescription(
  roleId: string | null,
  overrides: Record<string, RoleCommandOverride>,
): string {
  return [
    `Rol vinculado: ${formatRoleMention(roleId)}`,
    "",
    "**Overrides configurados**",
    formatOverrideList(overrides),
    "",
    "**Acciones conocidas en inherit**",
    formatInheritList(overrides),
  ].join("\n");
}

function createSummaryEmbed(
  title: string,
  color: number,
  roleId: string | null,
  overrides: Record<string, RoleCommandOverride>,
  extraFields: Array<{ name: string; value: string }> = [],
): Embed {
  return new Embed({
    title,
    description: buildSummaryDescription(roleId, overrides),
    color,
    fields: extraFields,
    footer: { text: OPTIONS_FOOTER },
  });
}

function buildSummaryEmbed(
  key: string,
  roleId: string | null,
  overrides: Record<string, RoleCommandOverride>,
): Embed {
  return createSummaryEmbed(
    `Politicas de moderacion - ${key}`,
    EmbedColors.Blurple,
    roleId,
    overrides,
  );
}

function buildUpdateEmbed(
  key: string,
  action: string,
  override: RoleCommandOverride,
  roleId: string | null,
  overrides: Record<string, RoleCommandOverride>,
): Embed {
  const color =
    override === "deny"
      ? EmbedColors.Red
      : override === "allow"
        ? EmbedColors.Green
        : EmbedColors.Yellow;

  return createSummaryEmbed(
    `Override actualizado - ${key}`,
    color,
    roleId,
    overrides,
    [{ name: "Accion", value: `**${action}** -> ${override}` }],
  );
}

@Declare({
  name: "control",
  description: "Configurar overrides de moderacion",
})
@Options(options)
export default class RoleControlCommand extends SubCommand {
  async run(ctx: GuildCommandContext<typeof options>) {
    const context = await requireGuildContext(ctx);
    if (!context) return;

    const key = ctx.options.key.trim();
    if (!key) {
      await ctx.write({
        content: "[!] Debes indicar la clave del rol administrado.",
      });
      return;
    }

    const store = context.store;
    const resolvedGuildId = context.storeGuildId;
    const loadSnapshot = async () =>
      await store.getGuildRole(resolvedGuildId, key);
    const snapshot = await loadSnapshot();
    if (!snapshot) {
      await ctx.write({
        content: "[!] No existe una configuracion con esa clave.",
      });
      return;
    }

    const reset = ctx.options.reset ?? false;
    const overrideInput = normalizeOverride(ctx.options.override ?? undefined);
    const actionInput = ctx.options.action?.trim();
    let resolvedAction: ResolvedAction | null = null;

    if (actionInput) {
      const actionOutcome = resolveActionInput(actionInput);
      if ("error" in actionOutcome) {
        const embed = new Embed({
          title: "Accion invalida",
          description: actionOutcome.error,
          color: EmbedColors.Red,
        });

        await ctx.write({ embeds: [embed] });
        return;
      }

      resolvedAction = actionOutcome.action;
    }

    try {
      if (reset) {
        const updated = await store.resetGuildRoleOverrides(resolvedGuildId, key);
        const embed = createSummaryEmbed(
          "Overrides reiniciados",
          EmbedColors.Green,
          updated.discordRoleId ?? null,
          updated.overrides ?? {},
        );

        await ctx.write({ embeds: [embed] });
        return;
      }

      if (actionInput) {
        if (!resolvedAction) {
          return;
        }

        if (ctx.options.override !== undefined && overrideInput === undefined) {
          await ctx.write({
            content: "[!] Override invalido. Usa inherit, allow o deny.",
          });
          return;
        }

        if (overrideInput) {
          await store.setGuildRoleOverride(
            resolvedGuildId,
            key,
            resolvedAction.key,
            overrideInput,
          );

          const updated = await loadSnapshot();
          const embed = buildUpdateEmbed(
            key,
            resolvedAction.definition.label ?? resolvedAction.key,
            overrideInput,
            updated?.discordRoleId ?? null,
            updated?.overrides ?? {},
          );

          await ctx.write({ embeds: [embed] });
          return;
        }

        const overrides = await store.getGuildRoleOverrides(
          resolvedGuildId,
          key,
        );
        const current = overrides[resolvedAction.key] ?? "inherit";
        const overridesRecord = { ...overrides };

        const embed = new Embed({
          title: `Override actual - ${resolvedAction.definition.label}`,
          description: `El override para **${resolvedAction.key}** es **${current}**.`,
          color: EmbedColors.Blurple,
          fields: [
            {
              name: "Resumen",
              value: formatOverrideList(overridesRecord),
            },
          ],
          footer: { text: OPTIONS_FOOTER },
        });

        await ctx.write({ embeds: [embed] });
        return;
      }

      const overrides = await store.getGuildRoleOverrides(
        resolvedGuildId,
        key,
      );
      const overridesRecord = { ...overrides } as Record<
        string,
        RoleCommandOverride
      >;
      const embed = buildSummaryEmbed(
        key,
        snapshot.discordRoleId ?? null,
        overridesRecord,
      );

      await ctx.write({ embeds: [embed] });
    } catch (error) {
      console.error("RoleControlCommand:", error);
      const embed = new Embed({
        title: "Error al actualizar overrides",
        description: error instanceof Error ? error.message : String(error),
        color: EmbedColors.Red,
      });

      await ctx.write({ embeds: [embed] });
    }
  }
}

