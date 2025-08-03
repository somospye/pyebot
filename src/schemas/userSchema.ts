import { integer, pgTable, uuid, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: uuid("id").primaryKey().default("gen_random_uuid()"),
	discord_id: varchar("discord_id", { length: 50 }).notNull().unique(),
	bank: integer("bank").notNull().default(0),
	cash: integer("cash").notNull().default(0),
});
