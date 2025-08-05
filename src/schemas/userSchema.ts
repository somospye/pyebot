import { integer, jsonb, pgTable, varchar } from "drizzle-orm/pg-core";

export type User = {
  id: string;
  bank: number;
  cash: number;
  warns: Warn[] | null;
};

export type Warn = {
  reason: string;
  warn_id: number; // incremental
  moderador: User;
  timestamp: string; // Date ISO
};

export const users = pgTable("users", {
  id: varchar("id", { length: 50 }).primaryKey().notNull().unique(),
  bank: integer("bank").notNull().default(0),
  cash: integer("cash").notNull().default(0),
  warns: jsonb("warns").$type<Warn[]>().default([]),
});
