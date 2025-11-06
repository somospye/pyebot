import { createEvent } from "seyfert";
import { emitMessageReactionAdd } from "@/events/hooks/messageReaction";

/**
 * Despacha el evento `messageReactionAdd` de Seyfert a todos los listeners registrados.
 */
export default createEvent({
  data: { name: "messageReactionAdd" },
  async run(message, client, shardId) {
    await emitMessageReactionAdd(message, client, shardId);
  },
});
