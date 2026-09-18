import type { ImapFlow, MessageStructureObject } from "imapflow";
import { simpleParser } from "mailparser";
import type { AttachmentInfo, MessageDetail } from "../types.ts";
import { formatAddr } from "./format.ts";

function formatHeaderValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(formatHeaderValue).join(", ");
  if (value && typeof value === "object") {
    if ("text" in value && typeof (value as { text?: unknown }).text === "string") {
      return (value as { text: string }).text;
    }
    if ("value" in value) {
      return formatHeaderValue((value as { value: unknown }).value);
    }
    if ("address" in value) {
      const addr = value as { name?: string; address?: string };
      return addr.name ? `${addr.name} <${addr.address ?? ""}>` : addr.address ?? "";
    }
  }
  return String(value);
}

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

function sanitizeFilename(name: string): string {
  const base = name.replace(/^.*[/\\]/, "");
  return base.replace(/^\.+/, "").trim() || "attachment";
}

function collectAttachmentParts(
  node: MessageStructureObject | undefined,
  out: AttachmentInfo[] = []
): AttachmentInfo[] {
  if (!node) return out;
  const disposition = node.disposition?.toLowerCase();
  const filename =
    node.dispositionParameters?.filename ?? node.parameters?.name;
  if (disposition === "attachment" && node.part) {
    out.push({
      partId: node.part,
      filename: filename ? sanitizeFilename(filename) : `attachment-${node.part}`,
      contentType: node.type,
      size: node.size ?? 0,
    });
  }
  if (node.childNodes?.length) {
    for (const child of node.childNodes) collectAttachmentParts(child, out);
  }
  return out;
}

export async function fetchMessageDetail(
  client: ImapFlow,
  folder: string,
  uid: number
): Promise<MessageDetail> {
  const fetched = await client.fetchOne(
    String(uid),
    { envelope: true, flags: true, bodyStructure: true, source: true },
    { uid: true }
  );
  if (!fetched || !fetched.source) {
    throw new Error(`Message not found: uid ${uid} in folder ${folder}`);
  }

  const parsed = await simpleParser(fetched.source);

  const headers: Record<string, string> = {};
  for (const [key, value] of parsed.headers) {
    headers[key] = formatHeaderValue(value);
  }

  const attachments = collectAttachmentParts(fetched.bodyStructure);

  return {
    uid,
    folder,
    from: fetched.envelope?.from?.map(formatAddr).join(", ") ?? "",
    to: fetched.envelope?.to?.map(formatAddr) ?? [],
    subject: fetched.envelope?.subject ?? "",
    date: fetched.envelope?.date
      ? new Date(fetched.envelope.date).toISOString()
      : "",
    flags: Array.from(fetched.flags ?? []),
    snippet: (parsed.text ?? "").slice(0, 200).trim(),
    hasAttachments: attachments.length > 0,
    headers,
    bodyText: parsed.text ?? null,
    bodyHtml: typeof parsed.html === "string" ? parsed.html : null,
    attachments,
  };
}

export async function fetchAttachment(
  client: ImapFlow,
  uid: number,
  partId: string
): Promise<{ filename: string; contentType: string; contentBase64: string }> {
  const { meta, content } = await client.download(String(uid), partId, {
    uid: true,
    maxBytes: MAX_ATTACHMENT_BYTES,
  });

  if (meta.expectedSize && meta.expectedSize > MAX_ATTACHMENT_BYTES) {
    throw new Error(
      `Attachment too large: ${meta.expectedSize} bytes (max ${MAX_ATTACHMENT_BYTES})`
    );
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of content) {
    chunks.push(chunk as Buffer);
    total += (chunk as Buffer).length;
  }
  if (total >= MAX_ATTACHMENT_BYTES) {
    throw new Error(`Attachment too large: exceeds ${MAX_ATTACHMENT_BYTES} byte limit`);
  }
  const buffer = Buffer.concat(chunks);

  return {
    filename: meta.filename ? sanitizeFilename(meta.filename) : `attachment-${partId}`,
    contentType: meta.contentType ?? "application/octet-stream",
    contentBase64: buffer.toString("base64"),
  };
}

/** Adds or removes a flag on a message, returning its resulting flag set. */
export async function setFlag(
  client: ImapFlow,
  uid: number,
  flag: string,
  on: boolean
): Promise<string[]> {
  if (on) {
    await client.messageFlagsAdd(String(uid), [flag], { uid: true });
  } else {
    await client.messageFlagsRemove(String(uid), [flag], { uid: true });
  }
  const msg = await client.fetchOne(String(uid), { flags: true }, { uid: true });
  return Array.from((msg && msg.flags) || []);
}
