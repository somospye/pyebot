import { ComponentCommand, Embed } from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
import type { ComponentContext } from "seyfert/lib/components";

import {
  dispatchViewUpdate,
  getSession,
  handleDashboardAction,
  type DashboardAction,
} from "@/ui/dashboard/state";

function parseCustomId(customId: string): {
  sessionId: string;
  action: string;
  extra?: string;
} | null {
  const parts = customId.split(":");
  if (parts.length < 3 || parts[0] !== "rolesDash") return null;
  const [_, sessionId, action, extra] = parts;
  try {
    return {
      sessionId,
      action: decodeURIComponent(action),
      extra: extra ? decodeURIComponent(extra) : undefined,
    };
  } catch {
    return null;
  }
}

export default class RolesDashboardButtonHandler extends ComponentCommand {
  componentType = "Button" as const;
  customId = /^rolesDash:/;

  async run(context: ComponentContext<"Button">): Promise<void> {
    const parsed = parseCustomId(context.customId);
    if (!parsed) {
      return;
    }

    const session = getSession(parsed.sessionId);
    if (!session) {
      await context.update({
        embeds: [
          new Embed({
            title: "Sesion expirada",
            description: "Reabre el panel con /roles dashboard.",
            color: EmbedColors.Red,
          }),
        ],
        components: [],
      });
      await context.followup({
        content: "⚠️ La sesion ya no esta disponible.",
        flags: 1 << 6,
      });
      return;
    }

    if (session.moderatorId !== context.author.id) {
      await context.followup({
        content: "⚠️ Solo quien abrio el panel puede interactuar con el.",
        flags: 1 << 6,
      });
      return;
    }

    await context.deferUpdate();

    const result = await handleDashboardAction({
      session,
      action: parsed.action as DashboardAction,
      actorId: context.author.id,
      values: [],
      data: undefined,
      database: context.db?.instance,
    });

    await dispatchViewUpdate({ session, client: context.client, view: result.view });

    if (result.error) {
      await context.followup({ content: `⚠️ ${result.error}`, flags: 1 << 6 });
    } else if (result.notice) {
      await context.followup({ content: `✅ ${result.notice}`, flags: 1 << 6 });
    }
  }
}
