export function formatAddr(a?: { name?: string; address?: string }): string {
  return a?.name ? `${a.name} <${a.address ?? ""}>` : a?.address ?? "";
}
