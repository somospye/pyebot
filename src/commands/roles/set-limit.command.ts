import type { GuildCommandContext } from "seyfert";
import {
  createIntegerOption,
  createStringOption,
  Declare,
  Embed,
  Options,
  SubCommand,
} from "seyfert";
import { EmbedColors } from "seyfert/lib/common";

import * as repo from "@/modules/repo";
import {
  buildLimitRecord,
  formatLimitRecord,
  parseLimitWindowInput,
  requireGuildContext,
  resolveActionInput,
} from "./shared";

const options = {
  key: createStringOption({
    description: "Clave del rol administrado",
    required: true,
  }),
  action: createStringOption({
    description: "Accion de moderacion (kick, ban, warn, timeout, purge)",
    required: true,
  }),
  uses: createIntegerOption({
    description: "Cantidad de usos permitidos en la ventana",
    required: true,
    min_value: 1,
  }),
  window: createStringOption({
    description: "Ventana de tiempo (p. ej. 10m, 1h, 6h, 24h, 7d)",
    required: true,
    min_length: 1,
  }),
};

@Declare({
  name: "set-limit",
  description: "Configurar un limite de uso para una accion",
})
@Options(options)
export default class RoleSetLimitCommand extends SubCommand {
  async run(ctx: GuildCommandContext<typeof options>) {
    const context = await requireGuildContext(ctx);
    if (!context) return;

    const key = ctx.options.key.trim();
    if (!key) {
      const embed = new Embed({
        title: "Clave invalida",
        description: "Indica la clave del rol administrado que deseas editar.",
        color: EmbedColors.Red,
      });
      await ctx.write({ embeds: [embed] });
      return;
    }

    const actionResult = resolveActionInput(ctx.options.action);
    if ("error" in actionResult) {
      const embed = new Embed({
        title: "Accion invalida",
        description: actionResult.error,
        color: EmbedColors.Red,
      });
      await ctx.write({ embeds: [embed] });
      return;
    }
    const action = actionResult.action;

    const parsedWindow = parseLimitWindowInput(ctx.options.window);
    if (!parsedWindow) {
      const embed = new Embed({
        title: "Ventana invalida",
        description: "Usa un formato valido como 10m, 1h, 6h, 24h o 7d.",
        color: EmbedColors.Red,
      });
      await ctx.write({ embeds: [embed] });
      return;
    }

    // Ensure role exists
    const roleRec = await repo.getRole(context.guildId, key);
    if (!roleRec) {
      const embed = new Embed({
        title: "Rol no encontrado",
        description:
          "No existe una configuracion registrada con esa clave. Verifica el nombre e intentalo nuevamente.",
        color: EmbedColors.Red,
      });
      await ctx.write({ embeds: [embed] });
      return;
    }

    const uses = Math.max(0, Math.floor(ctx.options.uses));
    const limitRecord = buildLimitRecord(uses, parsedWindow.window);

    await repo.setRoleLimit(context.guildId, key, action.key, limitRecord);

    const updated = await repo.getRole(context.guildId, key);
    const configuredLimits = Object.keys((updated?.limits ?? {}) as Record<string, unknown>).length;

    const embed = new Embed({
      title: "Limite actualizado",
      color: EmbedColors.Blurple,
      fields: [
        { name: "Rol", value: key },
        { name: "Accion", value: action.key },
        { name: "Limite", value: formatLimitRecord(limitRecord) },
        { name: "Limites configurados", value: configuredLimits.toString() },
      ],
    });

    await ctx.write({ embeds: [embed] });
  }
}
