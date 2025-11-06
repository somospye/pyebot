import type { GuildCommandContext } from "seyfert";
import {
  createStringOption,
  Declare,
  Embed,
  Options,
  SubCommand,
} from "seyfert";
import { EmbedColors } from "seyfert/lib/common";


import {
  findManagedRole,
  formatLimitRecord,
  requireGuildContext,
  resolveActionInput,
} from "./shared";
import { clearRoleLimit } from "@/modules/repo";

const options = {
  key: createStringOption({
    description: "Clave del rol administrado",
    required: true,
  }),
  action: createStringOption({
    description: "Accion de moderacion cuyo limite se desea limpiar",
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

    const rawAction = ctx.options.action.trim();
    const resolvedAction = resolveActionInput(rawAction);
    if ("error" in resolvedAction) {
      const embed = new Embed({
        title: "Accion invalida",
        description: resolvedAction.error,
        color: EmbedColors.Red,
      });
      await ctx.write({ embeds: [embed] });
      return;
    }
    const action = resolvedAction.action;

    const role = await findManagedRole(context.guildId, key);
    if (!role) {
      const embed = new Embed({
        title: "Rol no encontrado",
        description:
          "No existe una configuracion registrada con esa clave. Verifica el nombre e intentalo nuevamente.",
        color: EmbedColors.Red,
      });
      await ctx.write({ embeds: [embed] });
      return;
    }

    const existing = role.limits[action.key];


    await clearRoleLimit(context.guildId, role.key, action.key);

    const updated = await findManagedRole(context.guildId, key);
    const remaining = updated ? Object.keys(updated.limits ?? {}).length : 0;

    const embed = new Embed({
      title:
        existing === undefined ? "Accion no configurada" : "Limite eliminado",
      description:
        existing === undefined
          ? "No habia un limite registrado para esa accion."
          : `La accion **${action.definition.label}** del rol **${key}** vuelve al comportamiento por defecto.`,
      color: existing === undefined ? EmbedColors.Orange : EmbedColors.Yellow,
      fields: [
        {
          name: "Limites restantes",
          value: remaining.toString(),
        },
        ...(existing
          ? [
            {
              name: "Limite anterior",
              value: formatLimitRecord(existing),
            },
          ]
          : []),
      ],
    });

    await ctx.write({ embeds: [embed] });
  }
}
