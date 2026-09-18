import type { ImapClient } from "../imap/client.ts";
import { listFolders } from "../imap/mailboxes.ts";

export function registerListFolders(imap: ImapClient) {
  return {
    name: "list_folders",
    config: {
      description: "List all Yahoo Mail folders/mailboxes.",
      inputSchema: {},
    },
    handler: async () => {
      const folders = await imap.withClient((client) => listFolders(client));
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ folders }, null, 2) },
        ],
      };
    },
  };
}
