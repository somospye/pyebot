import { Embed, ModalCommand } from "seyfert";
import type { ModalContext } from "seyfert/lib/components";
import { EmbedColors } from "seyfert/lib/common";

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

function findValue(context: ModalContext, componentId: string): string | undefined {
  for (const row of context.components) {
    for (const component of row.components) {
      if (component.customId === componentId) {
        return component.value;
      }
    }
  }
  return undefined;
}

export default class RolesDashboardModalHandler extends ModalCommand {
  async filter(context: ModalContext): Promise<boolean> {
    return context.customId.startsWith("rolesDash:");
  }

  async run(context: ModalContext): Promise<void> {
    const parsed = parseCustomId(context.customId);
    if (!parsed) return;

    const session = getSession(parsed.sessionId);
    if (!session) {
      const embed = new Embed({
        title: "Sesion expirada",
        description: "Reabre el panel con /roles dashboard.",
        color: EmbedColors.Red,
      });
      await context.deferReply(true);
      await context.editResponse({ embeds: [embed], components: [] });
      await context.followup({
        content: "⚠️ La sesion ya no esta disponible.",
        flags: 1 << 6,
      });
      return;
    }

    if (session.moderatorId !== context.author.id) {
      await context.deferReply(true);
      await context.editResponse({ content: "⚠️ Solo quien abrio el panel puede interactuar con el.", flags: 1 << 6 });
      return;
    }

    const action = parsed.action as DashboardAction;
    const data: Record<string, unknown> = {};

    if (action === "rename_confirm") {
      data.label = findValue(context, "label") ?? "";
    } else if (action === "set_limit") {
      data.actionKey = parsed.extra ?? "";
      data.limitValue = findValue(context, "limitValue");
      data.windowValue = findValue(context, "windowValue") ?? "";
    }

    await context.deferReply(true);

    const result = await handleDashboardAction({
      session,
      action,
      actorId: context.author.id,
      values: [],
      data,
      database: context.db?.instance,
    });

    await dispatchViewUpdate({ session, client: context.client, view: result.view });

    if (result.error) {
      await context.editResponse({ content: `⚠️ ${result.error}`, flags: 1 << 6 });
    } else if (result.notice) {
      await context.editResponse({ content: `✅ ${result.notice}`, flags: 1 << 6 });
    }
    else {
      await context.deleteResponse().catch(() => {});
    }
  }
}
