import CooldownMiddleware from "./cooldown";
import { moderationLimit } from "./moderationLimit";

export const middlewares = {
  cooldown: CooldownMiddleware,
  moderationLimit,
};
