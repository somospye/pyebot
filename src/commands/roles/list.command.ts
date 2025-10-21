import type { GuildCommandContext } from "seyfert";
import { Declare, Embed, SubCommand } from "seyfert";
import { EmbedColors } from "seyfert/lib/common";

import * as repo from "@/modules/repo";
import {
  DEFAULT_MODERATION_ACTIONS,
  type RoleCommandOverride,
} from "@/modules/guild-roles";
import type { RoleLimitRecord, LimitWindow } from "@/schemas/guild";

const normKey = (k: string) => k.trim().toLowerCase().replace(/[\s-]+/g, "_");

function windowToSeconds(window: LimitWindow): number {
  const m = window.match(/^(\d+)(m|h|d)$/)!;
  const v = Number(m[1]);
  const u = m[2];
  return u === "m" ? v * 60 : u === "h" ? v * 3600 : v * 86400;
}

function secondsToTimeString(totalSeconds: number): string {
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
}

function formatOverrideValue(override: RoleCommandOverride | undefined): string {
  return override === "allow" ? "Permitir" : override === "deny" ? "Denegar" : "Heredar";
}

function formatLimitRecord(limit: RoleLimitRecord | undefined): string {
  if (!limit || !Number.isFinite(limit.limit) || limit.limit <= 0) return "Sin limite configurado";
  const count = Math.max(0, Math.floor(limit.limit));
  const win = limit.window ? secondsToTimeString(windowToSeconds(limit.window)) : "sin ventana fija";
  return `${count} uso(s) - ${win}`;
}

@Declare({
  name: "list",
  description: "Listar roles administrados y sus limites",
})
export default class RoleListCommand extends SubCommand {
  async run(ctx: GuildCommandContext) {
    const guildId = ctx.guildId;
    if (!guildId) {
      await ctx.write({
        embeds: [
          new Embed({
            title: "Roles administrados",
            description: "Este comando solo puede ejecutarse dentro de un servidor.",
            color: EmbedColors.Red,
          }),
        ],
      });
      return;
    }

    await repo.ensureGuild(guildId);

    // Pull raw roles JSON and normalize fields
    const rolesObj = (await repo.readRoles(guildId)) as Record<string, any>;
    const roles = Object.entries(rolesObj ?? {}).map(([key, rec]) => {
      const overridesRaw = (rec?.overrides ?? rec?.reach ?? {}) as Record<string, RoleCommandOverride>;
      const limitsRaw = (rec?.limits ?? {}) as Record<string, RoleLimitRecord>;
      const overrides: Record<string, RoleCommandOverride> = {};
      for (const [k, v] of Object.entries(overridesRaw)) overrides[normKey(k)] = v as RoleCommandOverride;
      const limits: Record<string, RoleLimitRecord> = {};
      for (const [k, v] of Object.entries(limitsRaw)) limits[normKey(k)] = v as RoleLimitRecord;

      return {
        key,
        label: rec?.label ?? key,
        discordRoleId: rec?.discordRoleId ?? rec?.discord_role_id ?? rec?.discordId ?? rec?.id ?? null,
        overrides,
        limits,
      };
    });

    if (!roles.length) {
      const empty = new Embed({
        title: "Roles administrados",
        description: "No hay configuraciones registradas.",
        color: EmbedColors.Greyple,
      });
      await ctx.write({ embeds: [empty] });
      return;
    }

    const fields = roles.map((r) => {
      const summary = DEFAULT_MODERATION_ACTIONS
        .map((a) => `- **${a.label}** -> ${formatOverrideValue(r.overrides[a.key])} - ${formatLimitRecord(r.limits[a.key])}`)
        .join("\n");

      return {
        name: `${r.key} - ${r.label}`,
        value: [
          r.discordRoleId ? `Rol vinculado: <@&${r.discordRoleId}>` : "Rol vinculado: Sin asignar",
          "",
          summary,
        ].join("\n"),
      };
    });

    const embed = new Embed({
      title: "Roles administrados",
      color: EmbedColors.Blurple,
      fields,
    });

    await ctx.write({ embeds: [embed] });
  }
}
