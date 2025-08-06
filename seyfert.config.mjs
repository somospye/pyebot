// @ts-check
import "dotenv/config";
import { config } from "seyfert";

const { TOKEN } = process.env;

if (!TOKEN) throw Error("missing 'TOKEN' env variable");

export default config.bot({
  locations: {
    base: "dist",
    commands: "commands",
    events: "events",
  },
  token: TOKEN,
  intents: ["Guilds", "GuildMessages", "MessageContent"], // faltan agregar más intents
});
