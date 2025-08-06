import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const { DATABASE_URL } = process.env;

if (!DATABASE_URL)
  throw Error("missing 'DATABASE_URL' env variable");

export default defineConfig({
  out: "./drizzle",
  schema: "./src/schemas/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL,
  },
});
