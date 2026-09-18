import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ImapClient } from "../imap/client.ts";
import { registerListFolders } from "./listFolders.ts";
import { registerSearchEmails } from "./searchEmails.ts";
import { registerGetEmail } from "./getEmail.ts";
import { registerGetAttachment } from "./getAttachment.ts";
import { registerMarkRead } from "./markRead.ts";
import { registerFlagEmail } from "./flagEmail.ts";
import { registerMoveEmail } from "./moveEmail.ts";
import { registerDeleteEmail } from "./deleteEmail.ts";

export function registerAllTools(server: McpServer, imap: ImapClient) {
  const definitions = [
    registerListFolders(imap),
    registerSearchEmails(imap),
    registerGetEmail(imap),
    registerGetAttachment(imap),
    registerMarkRead(imap),
    registerFlagEmail(imap),
    registerMoveEmail(imap),
    registerDeleteEmail(imap),
  ];

  for (const def of definitions) {
    server.registerTool(def.name, def.config, def.handler as never);
  }
}
