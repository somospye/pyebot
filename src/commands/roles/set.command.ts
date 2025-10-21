import type { GuildCommandContext } from "seyfert";
import {
  createRoleOption,
  createStringOption,
  Declare,
  Embed,
  Options,
  SubCommand,
} from "seyfert";
import { EmbedColors } from "seyfert/lib/common";

import * as repo from "@/modules/repo";
import { requireGuildContext } from "./shared";

const options = {
  key: createStringOption({
    description: "Identificador interno del rol administrado",
    required: true,
  }),
  role: createRoleOption({
    description: "Rol de Discord al que se aplicara la configuracion",
    required: true,
  }),
};

@Declare({
  name: "set",
  description: "Registrar o actualizar un rol administrado",
})
@Options(options)
export default class RoleSetCommand extends SubCommand {
  async run(ctx: GuildCommandContext<typeof options>) {
    const context = await requireGuildContext(ctx);
    if (!context) return;

    const key = ctx.options.key.trim();
    const roleId = String(ctx.options.role.id);

    if (!key) {
      const embed = new Embed({
        title: "Clave invalida",
        description: "Proporciona una clave no vacia para registrar el rol.",
        color: EmbedColors.Red,
      });
      await ctx.write({ embeds: [embed] });
      return;
    }

    await repo.ensureGuild(context.guildId);

    // Upsert minimal role record
    await repo.upsertRole(context.guildId, key, {
      label: key,
      discordRoleId: roleId,
      updatedBy: ctx.author.id,
    });

    // Read back the role to show current state
    const role = await repo.getRole(context.guildId, key);

    const embed = new Embed({
      title: "Rol administrado registrado",
      color: EmbedColors.Green,
      fields: [
        { name: "Clave", value: key },
        {
          name: "Rol",
          value: role?.discordRoleId ? `<@&${role.discordRoleId}>` : "Sin asignar",
        },
        {
          name: "Limites configurados",
          value: String(Object.keys((role?.limits ?? {}) as Record<string, unknown>).length),
        },
      ],
    });

    await ctx.write({ embeds: [embed] });
  }
}
