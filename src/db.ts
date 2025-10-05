import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";


// Ensure environment variables are loaded
config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

// Ping the database to ensure the connection is valid
pool.query("SELECT 1").catch((err) => {
  console.error("\n[ DATABASE NOT CONNECTED ]\n", err);
});
