import type { GuildCommandContext } from "seyfert";
import {
  Declare,
  Embed,
  Options,
  SubCommand,
  createIntegerOption,
  createStringOption,
} from "seyfert";
import { EmbedColors } from "seyfert/lib/common";

import { describeWindow, saveRoleLimit } from "@/modules/guild-roles";
import { LIMIT_WINDOWS, type LimitWindow } from "@/schemas/guild";
import { parseDuration } from "@/utils/duration";

const options = {
  key: createStringOption({
    description: "Clave del rol administrado",
    required: true,
  }),
  action: createStringOption({
    description: "Accion identificada por el bot (ej. kick, ban, warn add)",
    required: true,
  }),
  uses: createIntegerOption({
    description: "Cantidad de usos permitidos en la ventana",
    required: true,
    min_value: 1,
  }),
  window: createStringOption({
    description: "Ventana de tiempo (p. ej. 10m, 24h, 90s)",
    required: true,
    min_length: 1,
  }),
};

// Define o actualiza un limite de uso para una accion concreta.
@Declare({
  name: "set-limit",
  description: "Configurar un limite de uso para una accion",
})
@Options(options)
export default class RoleSetLimitCommand extends SubCommand {
  async run(ctx: GuildCommandContext<typeof options>) {
    const key = ctx.options.key.trim();
    const rawAction = ctx.options.action.trim();

    if (rawAction.includes('.')) {
      const embed = new Embed({
        title: "Formato de accion invalido",
        description: "Usa el nombre completo del comando con espacios, por ejemplo `warn add`.",
        color: EmbedColors.Red,
      });

      await ctx.write({ embeds: [embed] });
      return;
    }

    const action = rawAction.toLowerCase();
    const uses = ctx.options.uses;
    const windowInput = ctx.options.window.trim();
    const windowSeconds = parseDuration(windowInput);

    if (!key || !action) {
      const embed = new Embed({
        title: "Datos incompletos",
        description: "La clave y la accion deben contener al menos un caracter.",
        color: EmbedColors.Red,
      });

      await ctx.write({ embeds: [embed] });
      return;
    }

    if (windowSeconds === null) {
      const embed = new Embed({
        title: "Ventana invalida",
        description: "Usa un numero positivo o formatos como 10m, 24h, 90s.",
        color: EmbedColors.Red,
      });

      await ctx.write({ embeds: [embed] });
      return;
    }

    const windowMapping: Record<LimitWindow, number> = {
      "10m": 10 * 60,
      "1h": 60 * 60,
      "6h": 6 * 60 * 60,
      "24h": 24 * 60 * 60,
      "7d": 7 * 24 * 60 * 60,
    };

    const resolveWindow = (seconds: number): LimitWindow | null => {
      for (const option of LIMIT_WINDOWS) {
        if (seconds <= windowMapping[option]) {
          return option;
        }
      }
      return LIMIT_WINDOWS[LIMIT_WINDOWS.length - 1] ?? null;
    };

    const limitRecord = {
      limit: uses,
      window: resolveWindow(windowSeconds),
      windowSeconds,
    } as const;

    const record = await saveRoleLimit(
      ctx.guildId,
      key,
      action,
      limitRecord,
      ctx.db.instance,
    );

    const embed = new Embed({
      title: "Limite actualizado",
      color: EmbedColors.Blurple,
      fields: [
        { name: "Rol", value: key },
        { name: "Accion", value: action },
        {
          name: "Limite",
          value: `${uses} usos cada ${describeWindow(limitRecord)}`,
        },
        {
          name: "Limites configurados",
          value: Object.keys(record.limits ?? {}).length.toString(),
        },
      ],
    });

    await ctx.write({ embeds: [embed] });
  }
}
