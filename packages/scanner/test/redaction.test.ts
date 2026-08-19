import { describe, expect, it } from "vitest";

import { redactSecretUrl } from "../src/index.js";

describe("redactSecretUrl", () => {
  it("redacts Alchemy keys and userinfo", () => {
    expect(redactSecretUrl("https://base-mainnet.g.alchemy.com/v2/super-secret-key")).toContain(
      "[REDACTED]",
    );
    expect(redactSecretUrl("https://user:token@example.com/rpc")).toContain("REDACTED");
  });
});
