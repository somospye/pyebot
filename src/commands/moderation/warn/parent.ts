import { AutoLoad, Command, Declare } from "seyfert";

@Declare({
  name: "warn",
  description: "Manejar los warns de los usuarios",
})
@AutoLoad()
export default class WarnParent extends Command {}
