import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ImapClient } from "../imap/client.ts";
import type { SmtpClient } from "../smtp/client.ts";
import { registerListFolders } from "./listFolders.ts";
import { registerSearchEmails } from "./searchEmails.ts";
import { registerGetEmail } from "./getEmail.ts";
import { registerGetAttachment } from "./getAttachment.ts";
import { registerMarkRead } from "./markRead.ts";
import { registerFlagEmail } from "./flagEmail.ts";
import { registerMoveEmail } from "./moveEmail.ts";
import { registerDeleteEmail } from "./deleteEmail.ts";
import { registerSendEmail } from "./sendEmail.ts";

export function registerAllTools(server: McpServer, imap: ImapClient, smtp: SmtpClient) {
  const definitions = [
    registerListFolders(imap),
    registerSearchEmails(imap),
    registerGetEmail(imap),
    registerGetAttachment(imap),
    registerMarkRead(imap),
    registerFlagEmail(imap),
    registerMoveEmail(imap),
    registerDeleteEmail(imap, server),
    registerSendEmail(server, smtp),
  ];

  for (const def of definitions) {
    server.registerTool(def.name, def.config, def.handler as never);
  }
}
