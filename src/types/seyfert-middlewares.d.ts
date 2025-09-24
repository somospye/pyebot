import type { ParseMiddlewares } from "seyfert";
import type * as middlewares from "@/middlewares";

declare module "seyfert" {
  interface RegisteredMiddlewares extends ParseMiddlewares<typeof middlewares> {}
}
