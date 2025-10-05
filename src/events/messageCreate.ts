import { createEvent } from "seyfert";
import { emitMessageCreate } from "@/events/hooks/messageCreate";

// import "@/events/messageCreate/autoModSystem";
// import "@/events/messageCreate/aiResponse";
// import "@/events/messageCreate/autoFormatCode";

/**
 * Despacha el evento `messageCreate` de Seyfert a todos los listeners registrados.
 */
export default createEvent({
  data: { name: "messageCreate" },
  async run(message, client, shardId) {
    await emitMessageCreate(message, client, shardId);
  },
});
