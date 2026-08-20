const HEX_SECRET_ENV = /((?:PRIVATE_KEY|MNEMONIC|SECRET|API_KEY|ETHERSCAN_API_KEY)\s*[=:]\s*)\S+/gi;

export function redactSecrets(text: string, privateKey?: string): string {
  let out = text.replace(HEX_SECRET_ENV, "$1[REDACTED]");
  if (privateKey !== undefined && privateKey.length > 0) {
    const variants = new Set([
      privateKey,
      privateKey.toLowerCase(),
      privateKey.toUpperCase(),
      privateKey.replace(/^0x/i, ""),
      privateKey.replace(/^0x/i, "").toLowerCase(),
    ]);
    for (const variant of variants) {
      if (variant.length >= 8) {
        out = out.split(variant).join("[REDACTED]");
      }
    }
  }
  return out;
}

export function containsPrivateKey(text: string, key: string): boolean {
  if (key.length === 0) {
    return false;
  }
  const normalized = key.toLowerCase().replace(/^0x/, "");
  return text.toLowerCase().includes(normalized);
}
