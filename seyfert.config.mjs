import "dotenv/config";
import { config } from "seyfert";

export default config.bot({
	locations: {
		base: "dist",
		commands: "commands",
		events: "events",
	},
	token: process.env.TOKEN ?? "",
	intents: ["Guilds"], // faltan agregar más intents
});
