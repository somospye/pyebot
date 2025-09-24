import { AutoLoad, Command, Declare } from "seyfert";

// Espacio raiz para administrar roles del bot.
@Declare({
  name: "roles",
  description: "Gestionar roles administrados por el bot",
  defaultMemberPermissions: ["ManageGuild"],
  contexts: ["Guild"],
  integrationTypes: ["GuildInstall"],
})
@AutoLoad()
export default class RoleParentCommand extends Command {}
