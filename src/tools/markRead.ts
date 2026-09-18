import { z } from "zod";
import type { ImapClient } from "../imap/client.ts";
import { setFlag } from "../imap/message.ts";
import { jsonResult } from "./respond.ts";
import { UNTRUSTED_CONTENT_NOTICE } from "./shared.ts";

const inputShape = {
  folder: z.string(),
  uid: z.number().int().positive(),
  read: z.boolean(),
};

export function registerMarkRead(imap: ImapClient) {
  return {
    name: "mark_read",
    config: {
      description: `Mark an email read or unread. ${UNTRUSTED_CONTENT_NOTICE}`,
      inputSchema: inputShape,
    },
    handler: async (args: { folder: string; uid: number; read: boolean }) => {
      const flags = await imap.withMailbox(args.folder, (client) =>
        setFlag(client, args.uid, "\\Seen", args.read)
      );
      return jsonResult({ success: true, flags });
    },
  };
}
