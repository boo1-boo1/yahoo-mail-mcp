# Yahoo Mail MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Runtime: Node](https://img.shields.io/badge/runtime-node-339933.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/protocol-MCP-6b5bff.svg)](https://modelcontextprotocol.io)

MCP server exposing Yahoo Mail (via IMAP) as tools for Claude: list folders,
search/read emails, manage flags and folders.

## Setup

1. Generate a Yahoo App Password: Yahoo Account Security page -> "Generate
   app password". A regular account password will not work if 2FA is enabled.
2. Copy `.env.example` to `.env` and fill in your credentials:
   ```
   cp .env.example .env
   ```
3. Install dependencies (managed by devenv/pnpm):
   ```
   pnpm install
   ```
4. Build and run the server directly to confirm it authenticates without error:
   ```
   pnpm build
   pnpm start
   ```
   Ctrl-C to stop. If you see an `AuthenticationFailure`-related error, double
   check `YAHOO_APP_PASSWORD` is an app password, not your account password.

## Registering with Claude Code

```
claude mcp add yahoo-mail node /home/USER/Developer/yahoo-mail-mcp/dist/index.js
```

Or add to `.mcp.json`:

```json
{
  "mcpServers": {
    "yahoo-mail": {
      "command": "node",
      "args": ["/home/USER/Developer/yahoo-mail-mcp/dist/index.js"],
      "env": {
        "YAHOO_EMAIL": "you@yahoo.com",
        "YAHOO_APP_PASSWORD": "xxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

## Registering with Claude Desktop

Add to `claude_desktop_config.json` (Settings -> Developer -> Edit Config):

```json
{
  "mcpServers": {
    "yahoo-mail": {
      "command": "npx",
      "args": ["github:boo1-boo1/yahoo-mail-mcp"],
      "env": {
        "YAHOO_EMAIL": "you@yahoo.com",
        "YAHOO_APP_PASSWORD": "xxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

Or, running from a local clone instead of GitHub:

```json
{
  "mcpServers": {
    "yahoo-mail": {
      "command": "node",
      "args": ["/home/USER/Developer/yahoo-mail-mcp/dist/index.js"],
      "env": {
        "YAHOO_EMAIL": "you@yahoo.com",
        "YAHOO_APP_PASSWORD": "xxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

Restart Claude Desktop after editing the config.

## Tools

- `list_folders` - list all mailboxes.
- `search_emails` - search a folder by sender, subject, free text, date
  range, unread/flagged status. Returns lightweight summaries (newest first).
- `get_email` - fetch full content (headers, text/HTML body, attachment
  metadata) of one message by folder + UID.
- `get_attachment` - download one attachment's content (base64) by folder,
  UID, and `partId` (from `get_email`).
- `mark_read` - mark a message read/unread.
- `flag_email` - flag/unflag (star) a message.
- `move_email` - move a message to another folder.
- `delete_email` - soft delete (move to Trash) by default; `permanent: true`
  expunges immediately and **cannot be undone**.

All operations identify messages by IMAP UID (stable across sessions), not
sequence number.
