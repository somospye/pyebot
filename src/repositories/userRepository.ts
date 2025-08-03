import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { users } from "@/schemas/userSchema";

async function create(discordId: string) {
	return await db.insert(users).values({
		id: uuidv4(),
		discord_id: discordId,
	});
}

export const userRepository = {
	create,
};
