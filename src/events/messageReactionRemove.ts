import { createEvent } from "seyfert";
import { emitMessageReactionRemove } from "@/events/hooks/messageReaction";

/**
 * Despacha el evento `messageReactionRemove` de Seyfert a todos los listeners registrados.
 */
export default createEvent({
  data: { name: "messageReactionRemove" },
  async run(message, client, shardId) {
    await emitMessageReactionRemove(message, client, shardId);
  },
});
