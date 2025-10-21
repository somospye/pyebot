import { getDB, type UserId } from "@/modules/flat_api";
import type { Warn } from "@/schemas/user";

function warnStore() {
  return getDB();
}

export async function listWarns(userId: UserId): Promise<Warn[]> {
  return await warnStore().listUserWarns(userId);
}

export async function addWarn(
  userId: UserId,
  warn: Warn,
): Promise<Warn[]> {
  return await warnStore().addUserWarn(userId, warn);
}

export async function clearWarns(userId: UserId): Promise<void> {
  await warnStore().clearUserWarns(userId);
}

export async function removeWarn(
  userId: UserId,
  warnId: string,
): Promise<Warn[]> {
  return await warnStore().removeUserWarn(userId, warnId);
}

