import { describe, expect, it, vi } from "vitest";
import type { ImapFlow, MessageStructureObject } from "imapflow";
import {
  buildSearchObject,
  fetchSnippet,
  toMessageSummary,
} from "../src/imap/search.ts";

describe("buildSearchObject", () => {
  it("returns { all: true } for empty criteria", () => {
    expect(buildSearchObject({})).toEqual({ all: true });
  });

  it("maps simple string criteria verbatim", () => {
    expect(
      buildSearchObject({ from: "a@b.c", subject: "hi", text: "xyz" }),
    ).toEqual({ from: "a@b.c", subject: "hi", text: "xyz" });
  });

  it("maps date criteria verbatim", () => {
    expect(
      buildSearchObject({ since: "2026-01-01", before: "2026-02-01" }),
    ).toEqual({
      since: "2026-01-01",
      before: "2026-02-01",
    });
  });

  it("maps unreadOnly to seen: false", () => {
    expect(buildSearchObject({ unreadOnly: true })).toEqual({ seen: false });
  });

  it("maps flaggedOnly to flagged: true", () => {
    expect(buildSearchObject({ flaggedOnly: true })).toEqual({ flagged: true });
  });

  it("does not set all when any criterion present", () => {
    const q = buildSearchObject({ unreadOnly: true, from: "a@b.c" });
    expect(q).toEqual({ from: "a@b.c", seen: false });
  });
});

describe("toMessageSummary", () => {
  it("maps envelope fields", () => {
    const date = new Date("2026-01-02T03:04:05Z");
    const summary = toMessageSummary(
      "INBOX",
      {
        uid: 7,
        envelope: {
          from: [{ name: "Alice", address: "a@b.c" }],
          to: [{ address: "d@e.f" }],
          subject: "Hello",
          date,
        },
        flags: new Set(["\\Seen"]),
        bodyStructure: { type: "text/plain", part: "1" },
      },
      "snippet text",
    );
    expect(summary).toEqual({
      uid: 7,
      folder: "INBOX",
      from: "Alice <a@b.c>",
      to: ["d@e.f"],
      subject: "Hello",
      date: date.toISOString(),
      flags: ["\\Seen"],
      snippet: "snippet text",
      hasAttachments: false,
    });
  });

  it("defaults missing envelope and flags", () => {
    const summary = toMessageSummary("INBOX", { uid: 1 }, "");
    expect(summary.from).toBe("");
    expect(summary.to).toEqual([]);
    expect(summary.subject).toBe("");
    expect(summary.date).toBe("");
    expect(summary.flags).toEqual([]);
  });

  it("detects attachments in nested childNodes", () => {
    const bodyStructure: MessageStructureObject = {
      type: "multipart/mixed",
      childNodes: [
        { type: "text/plain", part: "1" },
        {
          type: "application/pdf",
          part: "2",
          disposition: "ATTACHMENT",
        },
      ],
    };
    expect(
      toMessageSummary("INBOX", { uid: 1, bodyStructure }, "").hasAttachments,
    ).toBe(true);
  });
});

describe("fetchSnippet", () => {
  function stream(buf: Buffer): AsyncIterable<Buffer> {
    return (async function* () {
      yield buf;
    })();
  }

  function mockClient(content: Buffer | null) {
    return {
      download: vi.fn(async () => ({ content: content && stream(content) })),
    } as unknown as ImapFlow;
  }

  it("downloads the text/plain part", async () => {
    const client = mockClient(Buffer.from("Hello world"));
    const snippet = await fetchSnippet(client, 5, {
      type: "text/plain",
      part: "1",
    });
    expect(snippet).toBe("Hello world");
    expect(client.download).toHaveBeenCalledWith("5", "1", {
      uid: true,
      maxBytes: 2000,
    });
  });

  it("prefers text/plain over text/html", async () => {
    const client = mockClient(Buffer.from("plain"));
    const snippet = await fetchSnippet(client, 1, {
      type: "multipart/alternative",
      childNodes: [
        { type: "text/html", part: "1" },
        { type: "text/plain", part: "2" },
      ],
    });
    expect(snippet).toBe("plain");
    expect(client.download).toHaveBeenCalledWith("1", "2", expect.anything());
  });

  it("falls back to html and strips tags", async () => {
    const client = mockClient(
      Buffer.from("<style>b{}</style><p>Hi <b>there</b></p>"),
    );
    const snippet = await fetchSnippet(client, 1, {
      type: "text/html",
      part: "1",
    });
    expect(snippet).toBe("Hi there");
  });

  it("returns empty string for missing structure", async () => {
    const client = mockClient(Buffer.from("x"));
    await expect(fetchSnippet(client, 1, undefined)).resolves.toBe("");
    expect(client.download).not.toHaveBeenCalled();
  });

  it("returns empty string when content is null", async () => {
    const client = mockClient(null);
    await expect(
      fetchSnippet(client, 1, { type: "text/plain", part: "1" }),
    ).resolves.toBe("");
  });

  it("truncates to 200 chars", async () => {
    const client = mockClient(Buffer.from("a".repeat(300)));
    const snippet = await fetchSnippet(client, 1, {
      type: "text/plain",
      part: "1",
    });
    expect(snippet).toHaveLength(200);
  });
});
