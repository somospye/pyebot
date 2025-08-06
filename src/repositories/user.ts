import { eq } from "drizzle-orm";
import type { If } from "seyfert/lib/common";
import { db } from "@/db";
import { type User, users, type Warn } from "@/schemas/user";

export async function create(discordId: string) {
  return await db
    .insert(users)
    .values({
      id: discordId,
    })
    .returning()
    .then((x) => x[0]);
}

export async function has(discordId: string): Promise<boolean> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, discordId))
    .limit(1);

  return result.length > 0;
}

export async function get<T extends boolean = false>(
  discordId: string,
  nullIfNotExist: T,
): Promise<If<T, User | null, User>> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, discordId))
    .limit(1)
    .then((x) => x[0]);

  if (result) return result;
  if (!result && nullIfNotExist) return null as never;
  return create(discordId);
}

export async function addWarn(discordId: string, newWarn: Warn) {
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

export async function removeWarn(discordId: string, warnId: number) {
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.id, discordId))
    .limit(1);

  if (userResult.length === 0) {
    throw new Error("Usuario no encontrado");
  }

  const user = userResult[0];
  const warns = user.warns ?? [];

  const filteredWarns = warns.filter((warn: Warn) => warn.warn_id !== warnId);

  if (filteredWarns.length === warns.length) {
    throw new Error(`No se encontró el warn con el ID ${warnId}`);
  }

  await db
    .update(users)
    .set({ warns: filteredWarns })
    .where(eq(users.id, discordId));
}
