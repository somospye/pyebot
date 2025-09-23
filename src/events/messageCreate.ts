import { createEvent } from "seyfert";
import { processMessage } from "@/services/ai";
import { AutoModSystem } from "@/systems/automod";
import { sendPaginatedMessages } from "@/utils/messages";

export default createEvent({
  data: { name: "messageCreate" },
  async run(message, client) {
    if (message.author?.bot) return;

    await AutoModSystem.getInstance(client).analyzeUserMessage(message);

    const { author, content } = message;
    const wasMentioned = message.mentions.users.find(
      (user) => user.id === client.applicationId,
    );
    const shouldReply =
      wasMentioned ||
      (message.referencedMessage &&
        message?.referencedMessage.author.id === client.applicationId);

    if (!shouldReply) return;

    const response = await processMessage({
      userId: author.id,
      message: content,
    });

    if (response.image) {
      const file = {
        filename: "sushi.png",
        data: response.image,
      };

      await message.reply({
        content: response.text,
        files: [file],
        allowed_mentions: { parse: [] },
      });

      return;
    }
    await sendPaginatedMessages(client, message, response.text, true);
  },
});
