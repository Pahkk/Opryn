const INVITE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function createInviteCode(bytes: Uint8Array) {
  const characters = Array.from(bytes.slice(0, 8), (value) =>
    INVITE_ALPHABET.charAt(value % INVITE_ALPHABET.length),
  ).join("");
  return `OPRYN-${characters.slice(0, 4)}-${characters.slice(4)}`;
}

export function normalizeInviteCredential(value: string) {
  const trimmed = value.trim();
  const compact = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.startsWith("OPRYN") && compact.length === 13) {
    const code = compact.slice(5);
    return `OPRYN-${code.slice(0, 4)}-${code.slice(4)}`;
  }
  // Preserve legacy invitation tokens, which are case-sensitive.
  return trimmed;
}
