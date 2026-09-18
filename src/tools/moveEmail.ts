import { z } from "zod";
import type { ImapClient } from "../imap/client.ts";

const inputShape = {
  folder: z.string(),
  uid: z.number().int().positive(),
  destinationFolder: z.string(),
};

export function registerMoveEmail(imap: ImapClient) {
  return {
    name: "move_email",
    config: {
      description: "Move an email from its current folder to another folder.",
      inputSchema: inputShape,
    },
    handler: async (args: { folder: string; uid: number; destinationFolder: string }) => {
      const result = await imap.withMailbox(args.folder, (client) =>
        client.messageMove(String(args.uid), args.destinationFolder, { uid: true })
      );
      if (!result) {
        throw new Error(`Message not found: uid ${args.uid} in folder ${args.folder}`);
      }
      const newUid = result.uidMap?.get(args.uid);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { success: true, newUid, destinationFolder: args.destinationFolder },
              null,
              2
            ),
          },
        ],
      };
    },
  };
}
