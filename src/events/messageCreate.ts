import { createEvent } from "seyfert";
import { processMessage } from "@/services/ai";
import { analyzeUserMessage } from "@/services/security";
import { sendPaginatedMessages } from "@/utils/messages";

export default createEvent({
  data: { name: "messageCreate" },
  async run(message, client) {
    if (message.author?.bot || message.webhookId) return;

    await analyzeUserMessage(message);

    const { author, content } = message;
    const wasMentioned = message.mentions.users.find(
      (user) => user.id === client.botId,
    );
    const shouldReply =
      wasMentioned ||
      (message.referencedMessage &&
        message?.referencedMessage.author.id === client.botId);

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
      await message.reply({ content: response.text, files: [file] });
      return;
    }

    await sendPaginatedMessages(message, response.text, true);
  },
});
