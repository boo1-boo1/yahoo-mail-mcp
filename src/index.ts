#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.ts";
import { ImapClient } from "./imap/client.ts";
import { SmtpClient } from "./smtp/client.ts";
import { registerAllTools } from "./tools/index.ts";

const config = loadConfig();
const imap = new ImapClient(config);
const smtp = new SmtpClient(config);

const server = new McpServer({
  name: "yahoo-mail-mcp",
  version: "0.1.0",
});

registerAllTools(server, imap, smtp);

const transport = new StdioServerTransport();
await server.connect(transport);

const shutdown = () => {
  void imap.shutdown().finally(() => {
    smtp.shutdown();
    process.exit(0);
  });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
