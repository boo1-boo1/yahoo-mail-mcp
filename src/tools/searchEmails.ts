import { z } from "zod";
import type { ImapClient } from "../imap/client.ts";
import { buildSearchObject, fetchSnippet, toMessageSummary } from "../imap/search.ts";

const inputShape = {
  folder: z.string().default("INBOX"),
  from: z.string().optional(),
  subject: z.string().optional(),
  text: z.string().optional(),
  since: z.string().optional(),
  before: z.string().optional(),
  unreadOnly: z.boolean().optional(),
  flaggedOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(25),
};

export function registerSearchEmails(imap: ImapClient) {
  return {
    name: "search_emails",
    config: {
      description:
        "Search emails in a Yahoo Mail folder by sender, subject, free text, date range, unread or flagged status. Returns lightweight summaries, newest first.",
      inputSchema: inputShape,
    },
    handler: async (args: {
      folder: string;
      from?: string;
      subject?: string;
      text?: string;
      since?: string;
      before?: string;
      unreadOnly?: boolean;
      flaggedOnly?: boolean;
      limit: number;
    }) => {
      const query = buildSearchObject(args);

      const result = await imap.withMailbox(args.folder, async (client) => {
        const uids = await client.search(query, { uid: true });
        if (!uids || uids.length === 0) {
          return { total: 0, messages: [] };
        }

        const sorted = [...uids].sort((a, b) => b - a);
        const page = sorted.slice(0, args.limit);

        const fetched = await client.fetchAll(page, {
          uid: true,
          envelope: true,
          flags: true,
          bodyStructure: true,
        }, { uid: true });

        const messages = [];
        for (const msg of fetched) {
          const snippet = await fetchSnippet(client, msg.uid, msg.bodyStructure);
          messages.push(toMessageSummary(args.folder, msg, snippet));
        }
        messages.sort((a, b) => (a.date < b.date ? 1 : -1));

        return { total: uids.length, messages };
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ folder: args.folder, ...result }, null, 2),
          },
        ],
      };
    },
  };
}
