import { AutoLoad, Command, Declare } from "seyfert";

@Declare({
  name: "tickets",
  description: "Configurar y manajar el sistema de tickets",
  contexts: ["Guild"],
  integrationTypes: ["GuildInstall"],
})
@AutoLoad()
export default class TicketsParent extends Command {}
