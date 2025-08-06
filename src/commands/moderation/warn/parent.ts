import { Command, Declare, Options } from "seyfert";

import { AddWarnCommand } from "./add.command";
import { ListWarnCommand } from "./list.command";
import { RemoveWarnCommand } from "./remove.command";

@Declare({
  name: "warn",
  description: "Manejar los warns de los usuarios",
})
@Options([AddWarnCommand, RemoveWarnCommand, ListWarnCommand])
export default class WarnParent extends Command {}
