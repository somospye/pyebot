import { createEvent } from "seyfert";
import { emitMessageReactionRemoveEmoji } from "@/events/hooks/messageReaction";

/**
 * Despacha el evento `messageReactionRemoveEmoji` de Seyfert a todos los listeners registrados.
 */
export default createEvent({
  data: { name: "messageReactionRemoveEmoji" },
  async run(message, client, shardId) {
    await emitMessageReactionRemoveEmoji(message, client, shardId);
  },
});
