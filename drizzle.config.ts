import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL)
  throw Error("missing 'DATABASE_URL' env variable");

export default defineConfig({
  out: "./drizzle",
  schema: "./src/schemas/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
