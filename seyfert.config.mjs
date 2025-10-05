import "dotenv/config";
import { config } from "seyfert";

if (!process.env.TOKEN) throw Error("missing 'TOKEN' env variable");

export default config.bot({
  locations: {
    base: "dist",
    commands: "commands",
    events: "events",
    components: "components",
  },
  token: process.env.TOKEN ?? "",
  intents: ["Guilds", "GuildMessages", "MessageContent"], // faltan agregar más intents
});
