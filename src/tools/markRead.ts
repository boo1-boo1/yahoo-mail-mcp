import { z } from "zod";
import type { ImapClient } from "../imap/client.ts";

const inputShape = {
  folder: z.string(),
  uid: z.number().int().positive(),
  read: z.boolean(),
};

export function registerMarkRead(imap: ImapClient) {
  return {
    name: "mark_read",
    config: {
      description: "Mark an email read or unread.",
      inputSchema: inputShape,
    },
    handler: async (args: { folder: string; uid: number; read: boolean }) => {
      const flags = await imap.withMailbox(args.folder, async (client) => {
        if (args.read) {
          await client.messageFlagsAdd(String(args.uid), ["\\Seen"], { uid: true });
        } else {
          await client.messageFlagsRemove(String(args.uid), ["\\Seen"], { uid: true });
        }
        const msg = await client.fetchOne(String(args.uid), { flags: true }, { uid: true });
        return Array.from((msg && msg.flags) || []);
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ success: true, flags }, null, 2) },
        ],
      };
    },
  };
}
