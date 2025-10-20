import { AutoLoad, Command, Declare } from "seyfert";

@Declare({
  name: "config",
  description: "Configurar sistemas y funciones del bot",
})
@AutoLoad()
export default class ConfigParent extends Command {}
