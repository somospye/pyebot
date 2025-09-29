import type { GuildCommandContext } from "seyfert";
import {
  Declare,
  Embed,
  Options,
  SubCommand,
  createRoleOption,
  createStringOption,
} from "seyfert";
import { EmbedColors } from "seyfert/lib/common";

import { upsertRole } from "@/modules/guild-roles";

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

// Crea o actualiza la configuracion basica de un rol administrado.
@Declare({
  name: "set",
  description: "Registrar o actualizar un rol administrado",
})
@Options(options)
export default class RoleSetCommand extends SubCommand {
  async run(ctx: GuildCommandContext<typeof options>) {
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

    const { record } = await upsertRole(
      ctx.guildId,
      {
        key,
        label: key,
        discordRoleId: roleId,
        updatedBy: ctx.author.id,
      },
      ctx.db.instance,
    );

    const embed = new Embed({
      title: "Rol administrado registrado",
      color: EmbedColors.Green,
      fields: [
        { name: "Clave", value: key },
        {
          name: "Rol",
          value: record.discordRoleId ? `<@&${record.discordRoleId}>` : "Sin asignar",
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
