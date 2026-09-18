import type { ImapFlow, ListResponse } from "imapflow";
import type { FolderNode } from "../types.ts";

export function toFolderNode(entry: ListResponse): FolderNode {
  return {
    path: entry.path,
    name: entry.name,
    delimiter: entry.delimiter,
    specialUse: entry.specialUse,
    flags: Array.from(entry.flags ?? []),
    hasChildren: entry.flags?.has("\\HasChildren") ?? false,
  };
}

export async function listFolders(client: ImapFlow): Promise<FolderNode[]> {
  const entries = await client.list();
  return entries.map(toFolderNode);
}

export async function resolveTrashPath(client: ImapFlow): Promise<string> {
  const entries = await client.list();
  const trash = entries.find((e) => e.specialUse === "\\Trash");
  if (trash) return trash.path;
  const byName = entries.find((e) => /^trash$/i.test(e.name));
  if (byName) return byName.path;
  return "Trash";
}
