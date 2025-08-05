import { eq } from "drizzle-orm";
import { db } from "@/db";
import { type User, users, type Warn } from "@/schemas/userSchema";

async function create(discordId: string) {
  return await db.insert(users).values({
    id: discordId,
  });
}

async function has(discordId: string): Promise<boolean> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, discordId))
    .limit(1);

  return result.length > 0;
}

async function get(discordId: string): Promise<User> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, discordId))
    .limit(1);

  return result[0];
}

async function addWarn(discordId: string, newWarn: Warn) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, discordId))
    .limit(1);

  if (user.length === 0) {
    throw new Error("Usuario no encontrado");
  }

  const existingWarns = user[0].warns ?? [];
  const updatedWarns = [...existingWarns, newWarn];

  await db
    .update(users)
    .set({ warns: updatedWarns })
    .where(eq(users.id, discordId));
}

export const userRepository = {
  create,
  has,
  get,
  addWarn,
};
