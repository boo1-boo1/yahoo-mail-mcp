import { describe, expect, it, vi } from "vitest";
import type { ImapFlow, MessageStructureObject } from "imapflow";
import {
  fetchAttachment,
  fetchMessageDetail,
  setFlag,
} from "../src/imap/message.ts";

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

function genClient(): ImapFlow {
  return {} as ImapFlow;
}

function stream(buf: Buffer): AsyncIterable<Buffer> {
  return (async function* () {
    yield buf;
  })();
}

describe("fetchMessageDetail", () => {
  const rawEmail = [
    "From: Alice <alice@example.com>",
    "To: bob@example.com",
    "Subject: Hi",
    "Date: Fri, 02 Jan 2026 03:04:05 GMT",
    "Message-ID: <m-1@example.com>",
    "Content-Type: text/plain",
    "",
    "Body line",
    "",
  ].join("\r\n");

  function envelope() {
    return {
      from: [{ name: "Alice", address: "alice@example.com" }],
      to: [{ address: "bob@example.com" }],
      subject: "Hi",
      date: new Date("2026-01-02T03:04:05Z"),
    };
  }

  it("parses source and maps detail fields", async () => {
    const client = {
      fetchOne: vi.fn(async () => ({
        envelope: envelope(),
        flags: new Set(["\\Seen"]),
        source: Buffer.from(rawEmail),
        bodyStructure: { type: "text/plain", part: "1" },
      })),
    } as unknown as ImapFlow;

    const detail = await fetchMessageDetail(client, "INBOX", 9);
    expect(client.fetchOne).toHaveBeenCalledWith(
      "9",
      { envelope: true, flags: true, bodyStructure: true, source: true },
      { uid: true },
    );
    expect(detail.uid).toBe(9);
    expect(detail.folder).toBe("INBOX");
    expect(detail.from).toBe("Alice <alice@example.com>");
    expect(detail.to).toEqual(["bob@example.com"]);
    expect(detail.subject).toBe("Hi");
    expect(detail.date).toBe("2026-01-02T03:04:05.000Z");
    expect(detail.flags).toEqual(["\\Seen"]);
    expect(detail.bodyText).toBe("Body line\n");
    expect(detail.bodyHtml).toBeNull();
    expect(detail.hasAttachments).toBe(false);
    expect(detail.headers["message-id"]).toBe("<m-1@example.com>");
    expect(detail.snippet).toBe("Body line");
  });

  it("collects attachments from bodyStructure", async () => {
    const bodyStructure: MessageStructureObject = {
      type: "multipart/mixed",
      childNodes: [
        { type: "text/plain", part: "1" },
        {
          type: "application/pdf",
          part: "2",
          disposition: "attachment",
          dispositionParameters: { filename: "../../report.pdf" },
          size: 1234,
        },
        {
          type: "image/png",
          part: "3",
          disposition: "attachment",
          size: 10,
        },
      ],
    };
    const client = {
      fetchOne: vi.fn(async () => ({
        envelope: envelope(),
        flags: new Set<string>(),
        source: Buffer.from(rawEmail),
        bodyStructure,
      })),
    } as unknown as ImapFlow;

    const detail = await fetchMessageDetail(client, "INBOX", 9);
    expect(detail.hasAttachments).toBe(true);
    expect(detail.attachments).toEqual([
      {
        partId: "2",
        filename: "report.pdf",
        contentType: "application/pdf",
        size: 1234,
      },
      {
        partId: "3",
        filename: "attachment-3",
        contentType: "image/png",
        size: 10,
      },
    ]);
  });

  it("throws when message missing", async () => {
    const client = {
      fetchOne: vi.fn(async () => undefined),
    } as unknown as ImapFlow;
    await expect(fetchMessageDetail(client, "INBOX", 1)).rejects.toThrow(
      "Message not found: uid 1 in folder INBOX",
    );
  });
});

describe("fetchAttachment", () => {
  it("returns sanitized filename and base64 content", async () => {
    const client = {
      download: vi.fn(async () => ({
        meta: {
          filename: "/tmp/../../evil name.png",
          contentType: "image/png",
        },
        content: stream(Buffer.from("hello")),
      })),
    } as unknown as ImapFlow;

    const result = await fetchAttachment(client, 3, "2");
    expect(result.filename).toBe("evil name.png");
    expect(result.contentType).toBe("image/png");
    expect(result.contentBase64).toBe(Buffer.from("hello").toString("base64"));
  });

  it("uses fallback filename when meta.filename missing", async () => {
    const client = {
      download: vi.fn(async () => ({
        meta: { contentType: undefined },
        content: stream(Buffer.from("")),
      })),
    } as unknown as ImapFlow;

    const result = await fetchAttachment(client, 3, "7");
    expect(result.filename).toBe("attachment-7");
    expect(result.contentType).toBe("application/octet-stream");
  });

  it("throws before downloading when expectedSize exceeds limit", async () => {
    const download = vi.fn(async () => ({
      meta: { expectedSize: MAX_ATTACHMENT_BYTES + 1 },
      content: stream(Buffer.from("should not be read")),
    }));
    const client = { download } as unknown as ImapFlow;

    await expect(fetchAttachment(client, 1, "1")).rejects.toThrow(
      `Attachment too large: ${MAX_ATTACHMENT_BYTES + 1} bytes (max ${MAX_ATTACHMENT_BYTES})`,
    );
  });

  it("throws when streamed size reaches limit", async () => {
    const client = {
      download: vi.fn(async () => ({
        meta: {},
        content: stream(Buffer.alloc(MAX_ATTACHMENT_BYTES)),
      })),
    } as unknown as ImapFlow;

    await expect(fetchAttachment(client, 1, "1")).rejects.toThrow(
      `Attachment too large: exceeds ${MAX_ATTACHMENT_BYTES} byte limit`,
    );
  });
});

describe("setFlag", () => {
  function client(flags: Set<string>) {
    return {
      messageFlagsAdd: vi.fn(async () => {}),
      messageFlagsRemove: vi.fn(async () => {}),
      fetchOne: vi.fn(async () => ({ flags })),
    } as unknown as ImapFlow;
  }

  it("adds flag and returns resulting set", async () => {
    const c = client(new Set(["\\Flagged", "\\Seen"]));
    await expect(setFlag(c, 5, "\\Flagged", true)).resolves.toEqual([
      "\\Flagged",
      "\\Seen",
    ]);
    expect(c.messageFlagsAdd).toHaveBeenCalledWith("5", ["\\Flagged"], {
      uid: true,
    });
    expect(c.messageFlagsRemove).not.toHaveBeenCalled();
  });

  it("removes flag", async () => {
    const c = client(new Set(["\\Seen"]));
    await expect(setFlag(c, 5, "\\Flagged", false)).resolves.toEqual([
      "\\Seen",
    ]);
    expect(c.messageFlagsRemove).toHaveBeenCalledWith("5", ["\\Flagged"], {
      uid: true,
    });
  });

  it("returns empty array when fetchOne yields nothing", async () => {
    const c = {
      messageFlagsAdd: vi.fn(async () => {}),
      fetchOne: vi.fn(async () => undefined),
    } as unknown as ImapFlow;
    await expect(setFlag(c, 5, "\\Flagged", true)).resolves.toEqual([]);
  });
});
