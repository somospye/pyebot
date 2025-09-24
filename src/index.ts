import "module-alias/register";
import "dotenv/config";

import type { ParseClient, ParseMiddlewares, UsingClient } from "seyfert";
import { Client, extendContext } from "seyfert";
import { db } from "@/db";
import { CooldownManager } from "@/modules/cooldown";
import * as repositories from "@/repositories";
import * as schemas from "@/schemas";
import { GuildLogger } from "@/utils/guildLogger";
import * as middlewares from "@/middlewares";

const context = extendContext((interaction) => {
  return {
    db: {
      instance: db,
      repositories,
      schemas,
    },
    getGuildLogger: async (): Promise<GuildLogger> => {
      return await new GuildLogger().init(interaction.client);
    },
  };
});

const client = new Client({
  context,
  globalMiddlewares: ["rateLimit"],
});

client.setServices({
  middlewares,
});
client
  .start()
  .then(() => client.uploadCommands({ cachePath: "./commands.json" }));

declare module "seyfert" {
  interface UsingClient extends ParseClient<Client<true>> {
    cooldown: CooldownManager;
  }
  interface ExtendContext extends ReturnType<typeof context> {}
  interface RegisteredMiddlewares
    extends ParseMiddlewares<typeof middlewares> {}
}
