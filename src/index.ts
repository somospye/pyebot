import type { ParseClient } from "seyfert";
import { Client } from "seyfert";

const client = new Client();
client.start();

declare module "seyfert" {
	interface UsingClient extends ParseClient<Client<true>> {}
}
