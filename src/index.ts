import "module-alias/register";

import type { ParseClient } from "seyfert";
import { Client, extendContext } from "seyfert";
import { db } from "@/db";
import * as repositories from "@/repositories";
import * as schemas from "@/schemas";
import { GuildLogger } from "@/utils/guildLogger";

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

const client = new Client({ context });
client
  .start()
  .then(() => client.uploadCommands({ cachePath: "./commands.json" }));

declare module "seyfert" {
  interface UsingClient extends ParseClient<Client<true>> {}
  interface ExtendContext extends ReturnType<typeof context> {}
}
