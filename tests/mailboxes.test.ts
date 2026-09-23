import { describe, expect, it, vi } from "vitest";
import type { ImapFlow, ListResponse } from "imapflow";
import { toFolderNode } from "../src/imap/mailboxes.ts";
import { resolveTrashPath } from "../src/imap/mailboxes.ts";

describe("toFolderNode", () => {
  it("maps list response fields", () => {
    const entry = {
      path: "INBOX",
      name: "INBOX",
      delimiter: "/",
      specialUse: "\\Inbox",
      flags: new Set(["\\HasChildren", "\\Marked"]),
    } as unknown as ListResponse;
    expect(toFolderNode(entry)).toEqual({
      path: "INBOX",
      name: "INBOX",
      delimiter: "/",
      specialUse: "\\Inbox",
      flags: ["\\HasChildren", "\\Marked"],
      hasChildren: true,
    });
  });

  it("handles missing flags", () => {
    const entry = {
      path: "INBOX",
      name: "INBOX",
      delimiter: ".",
      specialUse: undefined,
      flags: undefined,
    } as unknown as ListResponse;
    expect(toFolderNode(entry)).toEqual({
      path: "INBOX",
      name: "INBOX",
      delimiter: ".",
      specialUse: undefined,
      flags: [],
      hasChildren: false,
    });
  });
});

describe("resolveTrashPath", () => {
  function client(entries: Partial<ListResponse>[]) {
    return { list: vi.fn(async () => entries) } as unknown as ImapFlow;
  }

  it("prefers specialUse \\Trash", async () => {
    const client_ = client([
      { path: "Bulk", name: "Bulk", specialUse: "\\Junk" },
      { path: "Bin", name: "Bin", specialUse: "\\Trash" },
      { path: "Trash", name: "Trash", specialUse: undefined },
    ]);
    await expect(resolveTrashPath(client_)).resolves.toBe("Bin");
  });

  it("falls back to exact name Trash when specialUse absent", async () => {
    const client_ = client([
      { path: "Folders/Trash", name: "Trash", specialUse: undefined },
    ]);
    await expect(resolveTrashPath(client_)).resolves.toBe("Folders/Trash");
  });

  it("falls back to Trash literal when nothing matches", async () => {
    const client_ = client([{ path: "Other", name: "Other" }]);
    await expect(resolveTrashPath(client_)).resolves.toBe("Trash");
  });
});
