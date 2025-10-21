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

import * as repo from "@/modules/repo";
import {
  DEFAULT_MODERATION_ACTIONS,
  type RoleCommandOverride,
} from "@/modules/guild-roles";
import {
  requireGuildContext,
  resolveActionInput,
  type ResolvedAction,
} from "./shared";

const OVERRIDE_CHOICES: ReadonlyArray<{ name: string; value: RoleCommandOverride }> = [
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

function normalizeOverride(value: string | undefined): RoleCommandOverride | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  return v === "allow" || v === "deny" || v === "inherit" ? v : undefined;
}

function extractDiscordRoleId(rec: any): string | null {
  return (
    rec?.discordRoleId ??
    rec?.discord_role_id ??
    rec?.discordId ??
    rec?.id ??
    null
  );
}

function formatOverrideList(overrides: Record<string, RoleCommandOverride>): string {
  const entries = Object.entries(overrides);
  if (entries.length === 0) return "Todos heredan permisos de Discord.";
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([action, ov]) => `- **${action}** -> ${ov}`)
    .join("\n");
}

function formatInheritList(overrides: Record<string, RoleCommandOverride>): string {
  const known = DEFAULT_MODERATION_ACTIONS.map(a => a.key);
  const inherit = known.filter(a => overrides[a] === undefined).sort();
  return inherit.length ? inherit.map(a => `- ${a}`).join("\n") : "Sin acciones conocidas en modo inherit.";
}

function formatRoleMention(roleId: string | null): string {
  return roleId ? `<@&${roleId}>` : "Sin asignar";
}

function buildSummaryDescription(roleId: string | null, overrides: Record<string, RoleCommandOverride>): string {
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
    override === "deny" ? EmbedColors.Red :
      override === "allow" ? EmbedColors.Green :
        EmbedColors.Yellow;

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
      await ctx.write({ content: "[!] Debes indicar la clave del rol administrado." });
      return;
    }

    // Read role once to check existence and show metadata later
    const roleRec = await repo.getRole(context.guildId, key);
    if (!roleRec) {
      await ctx.write({ content: "[!] No existe una configuracion con esa clave." });
      return;
    }
    const roleId = extractDiscordRoleId(roleRec);

    const reset = ctx.options.reset ?? false;
    const overrideInput = normalizeOverride(ctx.options.override ?? undefined);
    const actionInput = ctx.options.action?.trim();
    let resolvedAction: ResolvedAction | null = null;

    if (actionInput) {
      const res = resolveActionInput(actionInput);
      if ("error" in res) {
        const embed = new Embed({
          title: "Accion invalida",
          description: res.error,
          color: EmbedColors.Red,
        });
        await ctx.write({ embeds: [embed] });
        return;
      }
      resolvedAction = res.action;
    }

    try {
      if (reset) {
        await repo.resetRoleOverrides(context.guildId, key);
        const overrides = (await repo.getRoleOverrides(context.guildId, key)) as Record<string, RoleCommandOverride>;
        const embed = createSummaryEmbed(
          "Overrides reiniciados",
          EmbedColors.Green,
          roleId,
          overrides,
        );
        await ctx.write({ embeds: [embed] });
        return;
      }

      if (actionInput) {
        if (!resolvedAction) return;

        if (ctx.options.override !== undefined && overrideInput === undefined) {
          await ctx.write({ content: "[!] Override invalido. Usa inherit, allow o deny." });
          return;
        }

        if (overrideInput) {
          await repo.setRoleOverride(context.guildId, key, resolvedAction.key, overrideInput);
          const overrides = (await repo.getRoleOverrides(context.guildId, key)) as Record<string, RoleCommandOverride>;
          const embed = buildUpdateEmbed(
            key,
            resolvedAction.definition.label ?? resolvedAction.key,
            overrideInput,
            roleId,
            overrides,
          );
          await ctx.write({ embeds: [embed] });
          return;
        }

        // Just show the current override for that action
        const overrides = (await repo.getRoleOverrides(context.guildId, key)) as Record<string, RoleCommandOverride>;
        const current = overrides[resolvedAction.key] ?? "inherit";
        const embed = new Embed({
          title: `Override actual - ${resolvedAction.definition.label}`,
          description: `El override para **${resolvedAction.key}** es **${current}**.`,
          color: EmbedColors.Blurple,
          fields: [{ name: "Resumen", value: formatOverrideList(overrides) }],
          footer: { text: OPTIONS_FOOTER },
        });
        await ctx.write({ embeds: [embed] });
        return;
      }

      // No specific action: show summary
      const overrides = (await repo.getRoleOverrides(context.guildId, key)) as Record<string, RoleCommandOverride>;
      const embed = buildSummaryEmbed(key, roleId, overrides);
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
