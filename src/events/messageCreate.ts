import { createEvent } from "seyfert";
import { processMessage } from "@/services/ai";

export default createEvent({
  data: { name: "messageCreate" },
  async run(message) {
    if (message.author?.bot) return;

    const { author, content } = message;
    const wasMentioned = message.mentions.users.find(
      (user) => user.id === process.env.CLIENT_ID,
    );
    const shouldReply =
      wasMentioned ||
      (message.referencedMessage &&
        message?.referencedMessage.author.id === process.env.CLIENT_ID);

    if (!shouldReply) return;

    const response = await processMessage({
      userId: author.id,
      message: content,
    });

    await message.reply({ content: response });
  },
});
