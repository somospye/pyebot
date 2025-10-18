import { createEvent } from "seyfert";
import { emitMessageReactionAdd } from "@/events/hooks/messageReaction";

/**
 * Despacha el evento `messageReactionAdd` de Seyfert a todos los listeners registrados.
 */
export default createEvent({
  data: { name: "messageReactionAdd" },
  async run(message, client, shardId) {
    console.debug("Event: messageReactionAdd", { emoji: message.emoji.name, userId: message.userId });
    await emitMessageReactionAdd(message, client, shardId);
  },
});
