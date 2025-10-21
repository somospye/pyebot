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

import { type RoleId } from "@/modules/repo";

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

// Crea o actualiza la configuracion basica de un rol administrado.
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

    const snapshot = await context.store.upsertGuildRole(
      context.storeGuildId,
      key,
      {
        label: key,
        discordRoleId: roleId as RoleId,
        updatedBy: ctx.author.id,
      },
    );

    const embed = new Embed({
      title: "Rol administrado registrado",
      color: EmbedColors.Green,
      fields: [
        { name: "Clave", value: key },
        {
          name: "Rol",
          value: snapshot.discordRoleId
            ? `<@&${snapshot.discordRoleId}>`
            : "Sin asignar",
        },
        {
          name: "Limites configurados",
          value: Object.keys(snapshot.limits ?? {}).length.toString(),
        },
      ],
    });

    await ctx.write({ embeds: [embed] });
  }
}


