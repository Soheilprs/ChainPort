const SECRET_QUERY_KEYS = ["apikey", "api_key", "key", "token", "secret", "password", "auth"];

export function redactSecretUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.username !== "" || url.password !== "") {
      url.username = "REDACTED";
      url.password = "REDACTED";
    }
    for (const key of [...url.searchParams.keys()]) {
      if (SECRET_QUERY_KEYS.includes(key.toLowerCase())) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }
    let rendered = url.toString();
    rendered = rendered.replace(/\/v2\/[A-Za-z0-9_-]{8,}/g, "/v2/[REDACTED]");
    rendered = rendered.replace(/\/v3\/[A-Za-z0-9_-]{8,}/g, "/v3/[REDACTED]");
    return rendered;
  } catch {
    return value.replace(/\/\/[^@\s]+@/g, "//[REDACTED]@");
  }
}

export function looksLikeSecretValue(value: string): boolean {
  if (value.length >= 24 && /^[A-Za-z0-9+/=_-]+$/.test(value)) {
    return true;
  }
  if (/^(0x)?[a-fA-F0-9]{64}$/.test(value)) {
    return true;
  }
  return false;
}

export function boundExcerpt(text: string, max = 200): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : `${compact.slice(0, max)}…`;
}
