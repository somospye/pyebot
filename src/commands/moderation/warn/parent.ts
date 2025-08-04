import { Command, Declare, Options } from "seyfert";

import { AddCommand } from "./add.command";
import { ListCommand } from "./list.command";
import { RemoveCommand } from "./remove.command";

@Declare({
  name: "warn",
  description: "Manejar los warns de los usuarios",
})
@Options([AddCommand, RemoveCommand, ListCommand])
export default class AccountCommand extends Command {}
