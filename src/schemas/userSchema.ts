import { integer, pgTable, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: varchar("id", { length: 50 }).primaryKey().notNull().unique(),
	bank: integer("bank").notNull().default(0),
	cash: integer("cash").notNull().default(0),
});
