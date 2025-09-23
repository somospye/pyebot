import { createMiddleware, Formatter } from "seyfert";
import { TimestampStyle } from "seyfert/lib/common";

export default createMiddleware<void>(async ({ context, next, stop }) => {
  const inCooldown = context.client.cooldown.context(context);

  //TODO: Mejorar mensaje

  typeof inCooldown === "number"
    ? stop(
        `Estas usando un comando muy seguido, intenta nuevamente en ${Formatter.timestamp(new Date(Date.now() + inCooldown), TimestampStyle.RelativeTime)}`,
      )
    : next();
});
