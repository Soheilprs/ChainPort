import { describe, expect, it } from "vitest";

import { redactSecrets } from "../src/index.js";

describe("secret redaction", () => {
  it("removes bearer tokens and PEM blocks from strings", () => {
    const raw =
      "Authorization Bearer ghp_secretvalue123 clone https://x-access-token:abc@github.com/acme/wallet -----BEGIN RSA PRIVATE KEY-----\nABC\n-----END RSA PRIVATE KEY-----";
    const redacted = redactSecrets(raw);
    expect(redacted).not.toContain("ghp_");
    expect(redacted).not.toContain("x-access-token:abc");
    expect(redacted).not.toContain("BEGIN RSA PRIVATE KEY");
    expect(redacted).toContain("[redacted]");
  });
});
