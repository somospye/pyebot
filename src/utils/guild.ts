import type { Guild } from "seyfert";

export const getMemberName = async (
  id: string,
  guild: Awaited<Guild<"cached" | "api">>,
) => {
  try {
    const member = await guild.members.fetch(id);
    return member.name;
  } catch {
    return "Desconocido";
  }
};
