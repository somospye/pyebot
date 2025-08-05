import { createEvent } from "seyfert";

export default createEvent({
  data: { name: "messageCreate" },
  async run(message) {
    if (message.author?.bot) return;
  },
});
