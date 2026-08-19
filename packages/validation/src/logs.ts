const SECRET = /(api[_-]?key|token|secret|password|mnemonic|private[_-]?key)[=:]\s*([^\s]+)/gi;
const HEX_KEY = /\b(0x)?[a-fA-F0-9]{64}\b/g;

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, "g");
const CONTROLS = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(11)}${String.fromCharCode(12)}${String.fromCharCode(14)}-${String.fromCharCode(31)}]`,
  "g",
);

export function stripAnsi(text: string): string {
  return text.replace(ANSI, "").replace(CONTROLS, "");
}

export function redactLogs(text: string): string {
  return stripAnsi(text).replace(SECRET, "$1=[REDACTED]").replace(HEX_KEY, "[REDACTED_KEY]");
}

export function boundLog(text: string, maxBytes: number): { text: string; truncated: boolean } {
  const redacted = redactLogs(text);
  const buffer = Buffer.from(redacted, "utf8");
  if (buffer.byteLength <= maxBytes) {
    return { text: redacted, truncated: false };
  }
  const slice = buffer.subarray(0, maxBytes).toString("utf8");
  return { text: `${slice}\n…[truncated]`, truncated: true };
}
