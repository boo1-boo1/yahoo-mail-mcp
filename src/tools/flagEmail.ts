import { z } from "zod";
import type { ImapClient } from "../imap/client.ts";
import { setFlag } from "../imap/message.ts";
import { jsonResult } from "./respond.ts";
import { UNTRUSTED_CONTENT_NOTICE } from "./shared.ts";

const inputShape = {
  folder: z.string(),
  uid: z.number().int().positive(),
  flagged: z.boolean(),
};

export function registerFlagEmail(imap: ImapClient) {
  return {
    name: "flag_email",
    config: {
      description: `Flag (star) or unflag an email. ${UNTRUSTED_CONTENT_NOTICE}`,
      inputSchema: inputShape,
    },
    handler: async (args: { folder: string; uid: number; flagged: boolean }) => {
      const flags = await imap.withMailbox(args.folder, (client) =>
        setFlag(client, args.uid, "\\Flagged", args.flagged)
      );
      return jsonResult({ success: true, flags });
    },
  };
}
