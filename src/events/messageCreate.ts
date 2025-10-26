import { createEvent } from "seyfert";
import { emitMessageCreate } from "@/events/hooks/messageCreate";

/**
 * Despacha el evento `messageCreate` de Seyfert a todos los listeners registrados.
 */
export default createEvent({
  data: { name: "messageCreate" },
  async run(message, client, shardId) {
    await emitMessageCreate(message, client, shardId);
  },
});
