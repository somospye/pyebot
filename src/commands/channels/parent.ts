import { AutoLoad, Command, Declare } from "seyfert";

// Espacio raiz de comandos para gestionar canales.
@Declare({
  name: "channels",
  description: "Gestionar los canales usados por el bot",
  defaultMemberPermissions: ["ManageGuild"],
  contexts: ["Guild"],
  integrationTypes: ["GuildInstall"],
})
@AutoLoad()
export default class ChannelParentCommand extends Command {}
