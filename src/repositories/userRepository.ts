import { db } from "@/db";
import { users } from "@/schemas/userSchema";

async function create(discordId: string) {
	return await db.insert(users).values({
		id: discordId,
	});
}

export const userRepository = {
	create,
};
