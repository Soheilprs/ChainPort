const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._\-+=/]+/gi,
  /token[=:]\s*[A-Za-z0-9._\-+=/]+/gi,
  /x-access-token:[^@\s]+/gi,
  /ghp_[A-Za-z0-9]+/g,
  /ghs_[A-Za-z0-9]+/g,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
];

export function redactSecrets(value: string): string {
  let redacted = value;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, "[redacted]");
  }
  return redacted;
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return redactSecrets(error.message);
  }
  return "Request failed";
}
