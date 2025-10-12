import { AutoLoad, Command, Declare } from "seyfert";

// Espacio raiz para administrar roles del bot.
@Declare({
    name: "uit",
    description: "Tests and Samples for UI module",
})
@AutoLoad()
export default class UIParentCommand extends Command { }