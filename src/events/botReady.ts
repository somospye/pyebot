import { createEvent } from "seyfert";
import { emitBotReady } from "./hooks/botReady";

/**
 * Despacha el evento `botReady` de Seyfert a todos los listeners registrados.
 */
export default createEvent({
  data: { name: "botReady" },
  async run(user, client) {
    client.logger.info(`${user.username} encendido!`);
    await emitBotReady(user, client);
  },
});
