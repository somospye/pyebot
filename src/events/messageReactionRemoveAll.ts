import { createEvent } from "seyfert";
import { emitMessageReactionRemoveAll } from "@/events/hooks/messageReaction";

/**
 * Despacha el evento `messageReactionRemoveAll` de Seyfert a todos los listeners registrados.
 */
export default createEvent({
  data: { name: "messageReactionRemoveAll" },
  async run(message, client, shardId) {
    await emitMessageReactionRemoveAll(message, client, shardId);
  },
});
