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
  intents: [
    "Guilds",
    "GuildMembers",
    "GuildModeration",
    "GuildExpressions",
    "GuildIntegrations",
    "GuildWebhooks",
    "GuildInvites",
    "GuildVoiceStates",
    "GuildPresences",
    "GuildMessages",
    "GuildMessageReactions",
    "GuildMessageTyping",
    "DirectMessages",
    "DirectMessageReactions",
    "DirectMessageTyping",
    "MessageContent",
    "GuildScheduledEvents",
    "AutoModerationConfiguration",
    "AutoModerationExecution",
    "GuildMessagePolls",
    "DirectMessagePolls",
  ], // all gateway intents
});
