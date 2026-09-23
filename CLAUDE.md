# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm install` - install deps.
- `pnpm build` - compile `src/` to `dist/` with `tsc` (required before running).
- `pnpm start` - run the built server (`node dist/index.js`, stdio transport, connects to Yahoo IMAP on start).
- `pnpm typecheck` - `tsc --noEmit`.
- Env managed via `devenv`/`direnv` (`devenv.nix`, `.envrc`); `pnpm`/`node` provided through devenv, not global install.
- Runtime env vars: `YAHOO_EMAIL`, `YAHOO_APP_PASSWORD` required; `IMAP_HOST`, `IMAP_PORT`, `IMAP_TLS` optional (see `src/config.ts` for defaults). Local dev copies `.env.example` to `.env`.

## Architecture

MCP server (stdio transport) exposing Yahoo Mail as tools, built on `@modelcontextprotocol/sdk`, `imapflow` for IMAP, `mailparser` for MIME parsing.

- `src/index.ts` - entry point (has `#!/usr/bin/env node` shebang; compiled to `dist/index.js`, which is the `bin` target for `npx github:boo1-boo1/yahoo-mail-mcp` - the `prepare` script builds it on git-dep install). Loads config, constructs one `ImapClient`, registers tools, connects stdio transport.
- `src/config.ts` - validates `process.env` with a zod schema into a typed `Config`; exits process on invalid env.
- `src/imap/client.ts` - `ImapClient` wraps a single long-lived `ImapFlow` connection.
  - `withClient(fn, { retry })` - ensures connected, runs `fn`, retries once after reconnect on connection-class errors (`ECONNRESET`/`ETIMEDOUT`/`EPIPE`/etc). Default `retry: true`.
  - `withMailbox(path, fn, { retry })` - same, plus opens/releases a mailbox lock around `fn`.
  - **`retry: false` is required for non-idempotent ops** (move/delete): if the connection drops after the server applies the command but before the ack arrives, a blind retry would re-run the op against a message that already moved/was already deleted. Read-only ops and flag add/remove (idempotent) use the default `retry: true`.
  - Trash mailbox path is resolved once via LIST and cached for the process lifetime (`getTrashPath`).
- `src/imap/` - IMAP-level helpers: `mailboxes.ts` (folder listing/trash resolution), `search.ts` (search query building, snippet extraction via `client.download` for correct charset handling), `message.ts` (fetch full message / attachment, MIME parsing via `mailparser`), `format.ts` (address formatting).
- `src/tools/` - one file per MCP tool (`listFolders.ts`, `searchEmails.ts`, `getEmail.ts`, `getAttachment.ts`, `markRead.ts`, `flagEmail.ts`, `moveEmail.ts`, `deleteEmail.ts`). Each exports a `register*(imap)` function returning `{ name, config, handler }`; `src/tools/index.ts` collects all of them and calls `server.registerTool` for each. To add a tool: create a new file following this pattern, add it to the `definitions` array in `index.ts`.
  - `respond.ts` - `jsonResult()` helper, wraps tool output as MCP `content` with JSON text.
  - `shared.ts` - `UNTRUSTED_CONTENT_NOTICE`: append to any tool description whose output may include untrusted email content, warning the model not to treat email subject/body as instructions.
- `src/types.ts` - shared domain types (`MessageSummary`, `MessageDetail`, `AttachmentInfo`, `FolderNode`).
- All message operations identify by IMAP UID (stable across sessions), never sequence number.
- Attachment downloads are capped at `MAX_ATTACHMENT_BYTES` (25 MB, `src/imap/message.ts`) to bound memory use; oversized attachments throw rather than buffering fully.
- `delete_email` defaults to soft delete (move to Trash); `permanent: true` expunges immediately and is unrecoverable. Without the `UIDPLUS` capability, IMAP `EXPUNGE` removes *all* `\Deleted`-flagged messages in the mailbox, not just the target - `deleteEmail.ts` warns via `console.error` when that capability is absent.

## Manual verification checklist

No live Yahoo account is available in the dev sandbox, so verify by hand against a real account after any change touching IMAP behavior:

1. `list_folders` - confirm real folder names come back (Yahoo typically uses `Inbox`, `Draft`, `Sent`, `Trash`, `Bulk Mail`, plus any custom ones).
2. `search_emails` on `INBOX` with `unreadOnly: true` - confirm results match what the Yahoo Mail web UI shows as unread.
3. `get_email` on one returned UID - confirm subject/body/attachments match the web UI.
4. `mark_read` then `flag_email` on that message - confirm state changes reflect in the web UI.
5. `move_email` to another folder, then `delete_email` (soft) on a disposable test message - confirm it lands in Trash.
6. Leave the server idle for 30+ minutes, then issue another tool call - confirm it reconnects rather than hanging or erroring.
