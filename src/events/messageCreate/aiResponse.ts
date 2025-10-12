import { onMessageCreate } from "@/events/hooks/messageCreate";
import { processMessage } from "@/services/ai";
import { sendPaginatedMessages } from "@/utils/messages";

/**
 * Listener que responde menciones al bot utilizando el servicio de IA.
 */
onMessageCreate(async (message, client) => {
  const { author, content } = message;

  if (author?.bot) {
    return;
  }

  // Si el bot no fue menciado directamente, no responder
  if (
    // Si el ID del bot no esta en las menciones
    !message.mentions.users.find((user) => user.id === client.applicationId) 
    
    // Y el mensaje no es una respuesta a un mensaje del bot
    && message.referencedMessage?.author?.id !== client.applicationId) {
    return;
  }

  const wasMentioned = message.mentions.users.find((user) => user.id === client.applicationId);
  const shouldReply =
    Boolean(wasMentioned) ||
    (message.referencedMessage?.author?.id === client.applicationId);

  if (!shouldReply) {
    return;
  }

  const response = await processMessage({
    userId: author.id,
    message: content,
  });

  if (response.image) {
    const file = {
      filename: "sushi.png",
      data: response.image,
    };

    await message.reply({ content: response.text, files: [file] });
    return;
  }

  await sendPaginatedMessages(client, message, response.text, true);
});
