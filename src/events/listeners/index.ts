import { readdirSync } from "node:fs";
import { join, extname, basename } from "node:path";

/**
 * Auto-register every listener module that lives alongside this index file.
 * Any new `*.ts` file dropped in this directory will be required once
 * at startup, which lets each module perform its side-effect registration
 * (e.g. `client.on("event", handler)`).
 */
const directory = __dirname;

for (const entry of readdirSync(directory)) {
  const fileExtension = extname(entry);
  const fileName = basename(entry);

  if (!fileExtension || fileExtension !== ".ts") continue;
  if (fileName.startsWith("index.")) continue;
  if (fileName.endsWith(".d.ts")) continue;

  // eslint-disable-next-line @typescript-eslint/no-var-requires -- dynamic registration logic
  require(join(directory, entry));
}
