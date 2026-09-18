import { z } from "zod";
import type { ImapClient } from "../imap/client.ts";
import { fetchMessageDetail } from "../imap/message.ts";

const inputShape = {
  folder: z.string(),
  uid: z.number().int().positive(),
};

export function registerGetEmail(imap: ImapClient) {
  return {
    name: "get_email",
    config: {
      description:
        "Fetch full content of one email by folder and UID: headers, plain/HTML body, and attachment metadata (attachment content is fetched separately via get_attachment).",
      inputSchema: inputShape,
    },
    handler: async (args: { folder: string; uid: number }) => {
      const detail = await imap.withMailbox(args.folder, (client) =>
        fetchMessageDetail(client, args.folder, args.uid)
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(detail, null, 2) },
        ],
      };
    },
  };
}
