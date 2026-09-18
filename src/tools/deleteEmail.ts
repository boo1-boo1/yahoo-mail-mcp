import { z } from "zod";
import type { ImapClient } from "../imap/client.ts";
import { jsonResult } from "./respond.ts";
import { UNTRUSTED_CONTENT_NOTICE } from "./shared.ts";

const inputShape = {
  folder: z.string(),
  uid: z.number().int().positive(),
  permanent: z.boolean().default(false),
};

export function registerDeleteEmail(imap: ImapClient) {
  return {
    name: "delete_email",
    config: {
      description:
        "Delete an email. By default moves it to Trash (soft delete, reversible). " +
        "If permanent=true, expunges it immediately and this cannot be undone - " +
        "only pass permanent=true when the human user has explicitly asked for a " +
        `permanent delete in this conversation. ${UNTRUSTED_CONTENT_NOTICE}`,
      inputSchema: inputShape,
    },
    handler: async (args: { folder: string; uid: number; permanent: boolean }) => {
      await imap.withMailbox(
        args.folder,
        async (client) => {
          if (args.permanent) {
            if (!client.capabilities.has("UIDPLUS")) {
              console.error(
                "WARNING: server lacks UIDPLUS - permanent delete expunges ALL " +
                  "messages already flagged \\Deleted in this mailbox, not just this one."
              );
            }
            const result = await client.messageDelete(String(args.uid), { uid: true });
            if (!result) {
              throw new Error(`Message not found: uid ${args.uid} in folder ${args.folder}`);
            }
          } else {
            const trashPath = await imap.getTrashPath(client);
            const result = await client.messageMove(String(args.uid), trashPath, {
              uid: true,
            });
            if (!result) {
              throw new Error(`Message not found: uid ${args.uid} in folder ${args.folder}`);
            }
          }
        },
        { retry: false }
      );
      return jsonResult({ success: true });
    },
  };
}
