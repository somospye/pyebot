import { AutoLoad, Command, Declare } from "seyfert";

@Declare({
  name: "warn",
  description: "Manejar los warns de los usuarios",
  contexts: ["Guild"],
  integrationTypes: ["GuildInstall"],
})
@AutoLoad()
export default class WarnParent extends Command {}
