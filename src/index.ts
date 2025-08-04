import type { ParseClient } from "seyfert";
import { Client, extendContext } from "seyfert";
import { db } from "./db";

const context = extendContext((_) => {
	return {
		db,
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
