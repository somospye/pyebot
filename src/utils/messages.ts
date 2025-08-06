import type {
  CommandContext,
  Interaction,
  Message,
  TextBaseGuildChannel,
} from "seyfert";

const DEFAULT_PAGE_LIMIT = 1900; // El limite por mensaje es aprox 2000 carácteres

type PaginateTarget =
  | Message
  | Interaction
  | CommandContext
  | {
      reply: (input: { content: string }) => Promise<unknown>;
      channel?: TextBaseGuildChannel;
    };

export async function sendPaginatedMessages(
  target: PaginateTarget,
  content: string,
  reply: boolean = false,
): Promise<void> {
  const pages = paginateText(content);

  for (const page of pages) {
    const message = page.trim();
    if (!message) continue;

    if (isReplyable(target) && reply) {
      await target.reply({ content: message });
    } else {
      throw new Error("Unsupported target for paginated message.");
    }
  }
}

export function paginateText(
  text: string,
  limit = DEFAULT_PAGE_LIMIT,
): string[] {
  const pages: string[] = [];
  let currentPage = "";

  for (const line of text.split("\n")) {
    const proposedPage = currentPage ? `${currentPage}\n${line}` : line;

    if (proposedPage.length > limit) {
      if (currentPage.trim().length > 0) {
        pages.push(currentPage.trim());
      }
      currentPage = line;
    } else {
      currentPage = proposedPage;
    }
  }

  if (currentPage.trim().length > 0) {
    pages.push(currentPage.trim());
  }

  return pages;
}

function isReplyable(
  target: unknown,
): target is { reply: (options: { content: string }) => Promise<unknown> } {
  return (
    typeof target === "object" &&
    target !== null &&
    "reply" in target &&
    typeof target.reply === "function"
  );
}
