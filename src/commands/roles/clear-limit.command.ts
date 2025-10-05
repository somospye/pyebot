import type { GuildCommandContext } from "seyfert";
import { Declare, Embed, Options, SubCommand, createStringOption } from "seyfert";
import { EmbedColors } from "seyfert/lib/common";

import { clearRoleLimit, getRoleLimit } from "@/modules/guild-roles";

const options = {
  key: createStringOption({
    description: "Clave del rol administrado",
    required: true,
  }),
  action: createStringOption({
    description: "Accion cuyo limite se desea limpiar",
    required: true,
  }),
};

// Elimina el limite configurado para una accion concreta.
@Declare({
  name: "clear-limit",
  description: "Eliminar el limite de una accion",
})
@Options(options)
export default class RoleClearLimitCommand extends SubCommand {
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

    if (!key || !action) {
      const embed = new Embed({
        title: "Datos incompletos",
        description: "La clave y la accion deben contener al menos un caracter.",
        color: EmbedColors.Red,
      });

      await ctx.write({ embeds: [embed] });
      return;
    }

    const existing = await getRoleLimit(
      ctx.guildId,
      key,
      action,
      ctx.db.instance,
    );

    const record = await clearRoleLimit(
      ctx.guildId,
      key,
      action,
      ctx.db.instance,
    );

    const embed = new Embed({
      title: existing === undefined
        ? "Accion no configurada"
        : "Limite eliminado",
      description: existing === undefined
        ? "No habia un limite registrado para esa accion."
        : `La accion **${action}** del rol **${key}** vuelve al comportamiento por defecto.`,
      color: existing === undefined ? EmbedColors.Orange : EmbedColors.Yellow,
      fields: [
        {
          name: "Limites restantes",
          value: Object.keys(record.limits ?? {}).length.toString(),
        },
      ],
    });

    await ctx.write({ embeds: [embed] });
  }
}
