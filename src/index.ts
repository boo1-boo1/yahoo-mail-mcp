import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.ts";
import { ImapClient } from "./imap/client.ts";
import { registerAllTools } from "./tools/index.ts";

const config = loadConfig();
const imap = new ImapClient(config);

const server = new McpServer({
  name: "yahoo-mail-mcp",
  version: "0.1.0",
});

registerAllTools(server, imap);

const transport = new StdioServerTransport();
await server.connect(transport);

process.on("SIGINT", async () => {
  await imap.shutdown();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await imap.shutdown();
  process.exit(0);
});
