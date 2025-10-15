import { readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

/**
 * Auto-import all Seyfert event modules located in this directory.
 * Each file is expected to default-export the result of `createEvent(...)`.
 */
const eventsDirectory = __dirname;

for (const entry of readdirSync(eventsDirectory)) {
  const fullPath = join(eventsDirectory, entry);
  if (statSync(fullPath).isDirectory()) continue;

  const extension = extname(entry);
  if (!extension || (extension !== ".ts" && extension !== ".js")) continue;

  const fileName = basename(entry);
  if (fileName.startsWith("index.")) continue;
  if (fileName.endsWith(".d.ts")) continue;

  // eslint-disable-next-line @typescript-eslint/no-var-requires -- dynamic event registration
  require(fullPath);
}
