import CooldownMiddleware from "./cooldown";
import { rateLimit } from "./rateLimit";

export const middlewares = {
  cooldown: CooldownMiddleware,
  rateLimit,
};
