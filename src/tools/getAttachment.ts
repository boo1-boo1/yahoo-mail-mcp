import { z } from "zod";
import type { ImapClient } from "../imap/client.ts";
import { fetchAttachment } from "../imap/message.ts";
import { jsonResult } from "./respond.ts";

const inputShape = {
  folder: z.string(),
  uid: z.number().int().positive(),
  partId: z.string(),
};

export function registerGetAttachment(imap: ImapClient) {
  return {
    name: "get_attachment",
    config: {
      description:
        "Download one attachment's content (base64-encoded) from an email, identified by folder, UID, and partId (from get_email's attachments list).",
      inputSchema: inputShape,
    },
    handler: async (args: { folder: string; uid: number; partId: string }) => {
      const attachment = await imap.withMailbox(args.folder, (client) =>
        fetchAttachment(client, args.uid, args.partId)
      );
      return jsonResult(attachment);
    },
  };
}
