import type { ImapFlow, MessageStructureObject, SearchObject } from "imapflow";
import type { MessageSummary } from "../types.ts";
import { formatAddr } from "./format.ts";

export interface SearchCriteria {
  from?: string;
  subject?: string;
  text?: string;
  since?: string;
  before?: string;
  unreadOnly?: boolean;
  flaggedOnly?: boolean;
}

export function buildSearchObject(criteria: SearchCriteria): SearchObject {
  const query: SearchObject = {};
  if (criteria.from) query.from = criteria.from;
  if (criteria.subject) query.subject = criteria.subject;
  if (criteria.text) query.text = criteria.text;
  if (criteria.since) query.since = criteria.since;
  if (criteria.before) query.before = criteria.before;
  if (criteria.unreadOnly) query.seen = false;
  if (criteria.flaggedOnly) query.flagged = true;
  if (Object.keys(query).length === 0) query.all = true;
  return query;
}

/** Depth-first search for the first text/plain (falling back to text/html) leaf part. */
function findTextPart(
  node: MessageStructureObject | undefined,
  preferHtml = false
): MessageStructureObject | undefined {
  if (!node) return undefined;
  const type = node.type?.toLowerCase() ?? "";
  if (type === "text/plain" && node.part) return node;
  if (preferHtml && type === "text/html" && node.part) return node;

  if (node.childNodes?.length) {
    for (const child of node.childNodes) {
      const found = findTextPart(child, preferHtml);
      if (found) return found;
    }
  }
  return undefined;
}

function decodeQuotedPrintable(input: string): Buffer {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "=" && i + 2 < input.length) {
      const hex = input.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
      if (hex === "\r\n" || input[i + 1] === "\n") {
        // soft line break - drop it
        i += hex[0] === "\r" ? 2 : 1;
        continue;
      }
    }
    bytes.push(ch.charCodeAt(0));
  }
  return Buffer.from(bytes);
}

function decodeBodyPart(raw: Buffer, encoding: string | undefined): string {
  const enc = encoding?.toLowerCase();
  if (enc === "base64") {
    return Buffer.from(raw.toString("ascii").replace(/[\r\n]/g, ""), "base64").toString("utf8");
  }
  if (enc === "quoted-printable") {
    return decodeQuotedPrintable(raw.toString("ascii")).toString("utf8");
  }
  return raw.toString("utf8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchSnippet(
  client: ImapFlow,
  uid: number,
  bodyStructure: MessageStructureObject | undefined
): Promise<string> {
  let node = findTextPart(bodyStructure, false);
  let isHtml = false;
  if (!node) {
    node = findTextPart(bodyStructure, true);
    isHtml = true;
  }
  if (!node || !node.part) return "";
  const partId = node.part;

  const message = await client.fetchOne(
    String(uid),
    { bodyParts: [{ key: partId, maxLength: 800 }] },
    { uid: true }
  );
  if (!message || !message.bodyParts) return "";
  const buf = message.bodyParts.get(partId);
  if (!buf) return "";
  const raw = decodeBodyPart(buf, node.encoding);
  const text = isHtml ? stripHtml(raw) : raw;
  return text.slice(0, 200).trim();
}

function hasAttachment(node: MessageStructureObject | undefined): boolean {
  if (!node) return false;
  const disposition = node.disposition?.toLowerCase();
  if (disposition === "attachment") return true;
  if (node.childNodes?.length) {
    return node.childNodes.some(hasAttachment);
  }
  return false;
}

export function toMessageSummary(
  folder: string,
  msg: {
    uid: number;
    envelope?: { from?: { name?: string; address?: string }[]; to?: { name?: string; address?: string }[]; subject?: string; date?: Date };
    flags?: Set<string>;
    bodyStructure?: MessageStructureObject;
  },
  snippet: string
): MessageSummary {
  return {
    uid: msg.uid,
    folder,
    from: msg.envelope?.from?.map(formatAddr).join(", ") ?? "",
    to: msg.envelope?.to?.map(formatAddr) ?? [],
    subject: msg.envelope?.subject ?? "",
    date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : "",
    flags: Array.from(msg.flags ?? []),
    snippet,
    hasAttachments: hasAttachment(msg.bodyStructure),
  };
}
