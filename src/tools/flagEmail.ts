import { z } from "zod";
import type { ImapClient } from "../imap/client.ts";

const inputShape = {
  folder: z.string(),
  uid: z.number().int().positive(),
  flagged: z.boolean(),
};

export function registerFlagEmail(imap: ImapClient) {
  return {
    name: "flag_email",
    config: {
      description: "Flag (star) or unflag an email.",
      inputSchema: inputShape,
    },
    handler: async (args: { folder: string; uid: number; flagged: boolean }) => {
      const flags = await imap.withMailbox(args.folder, async (client) => {
        if (args.flagged) {
          await client.messageFlagsAdd(String(args.uid), ["\\Flagged"], { uid: true });
        } else {
          await client.messageFlagsRemove(String(args.uid), ["\\Flagged"], { uid: true });
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
