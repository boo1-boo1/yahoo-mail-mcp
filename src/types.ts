export interface MessageSummary {
  uid: number;
  folder: string;
  from: string;
  to: string[];
  subject: string;
  date: string; // ISO
  flags: string[]; // e.g. ["\\Seen", "\\Flagged"]
  snippet: string;
  hasAttachments: boolean;
}

export interface AttachmentInfo {
  partId: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface MessageDetail extends MessageSummary {
  headers: Record<string, string>;
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: AttachmentInfo[];
}

export interface FolderNode {
  path: string;
  name: string;
  delimiter: string | false;
  specialUse?: string;
  flags: string[];
  hasChildren: boolean;
}
