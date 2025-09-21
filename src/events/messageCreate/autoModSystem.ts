import { onMessageCreate } from "@/events/hooks/messageCreate";
import { AutoModSystem } from "@/systems/automod";

/**
 * Listener encargado de ejecutar AutoMod en cada mensaje de usuarios reales.
 */
onMessageCreate(async (message, client) => {
  if (message.author?.bot) {
    return;
  }

  await AutoModSystem.getInstance(client).analyzeUserMessage(message);
});
