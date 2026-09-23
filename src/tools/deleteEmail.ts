import { z } from "zod";
import type { ImapClient } from "../imap/client.ts";
import { jsonResult } from "./respond.ts";
import {
  UNTRUSTED_CONTENT_NOTICE,
  confirmationDeclinedResult,
  confirmationUnavailableResult,
  requestUserConfirmation,
} from "./shared.ts";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const inputShape = {
  folder: z.string(),
  uid: z.number().int().positive(),
  permanent: z.boolean().default(false),
};

export function registerDeleteEmail(imap: ImapClient, server: McpServer) {
  return {
    name: "delete_email",
    config: {
      description:
        "Delete an email. Requires explicit user confirmation via a prompt before anything is deleted. " +
        "By default moves it to Trash (soft delete, reversible). " +
        "If permanent=true, expunges it immediately and this cannot be undone - " +
        "only pass permanent=true when the human user has explicitly asked for a " +
        `permanent delete in this conversation. ${UNTRUSTED_CONTENT_NOTICE}`,
      inputSchema: inputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    handler: async (args: { folder: string; uid: number; permanent: boolean }) => {
      const confirmation = await requestUserConfirmation(
        server,
        args.permanent
          ? `Permanently delete email uid ${args.uid} from folder "${args.folder}"? This cannot be undone.`
          : `Delete email uid ${args.uid} from folder "${args.folder}"? It will be moved to Trash.`
      );
      if (confirmation.status === "declined") {
        return jsonResult(confirmationDeclinedResult());
      }
      if (confirmation.status === "unavailable") {
        return jsonResult(confirmationUnavailableResult(confirmation.detail));
      }
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
