import { describe, expect, it } from "vitest";

import { DomainValidationError, parseGitHubRepositoryUrl } from "../src/index.js";

describe("parseGitHubRepositoryUrl", () => {
  it("normalizes https, trailing slash, and .git", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/acme/wallet.git/")).toEqual({
      host: "github.com",
      owner: "acme",
      repo: "wallet",
      url: "https://github.com/acme/wallet",
    });
  });

  it("accepts git SSH and host-only forms", () => {
    expect(parseGitHubRepositoryUrl("git@github.com:acme/wallet.git").url).toBe(
      "https://github.com/acme/wallet",
    );
    expect(parseGitHubRepositoryUrl("github.com/acme/wallet").owner).toBe("acme");
  });

  it("extracts owner and repo from tree URLs", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/acme/wallet/tree/main").repo).toBe(
      "wallet",
    );
  });

  it("rejects non-GitHub hosts and unsafe schemes", () => {
    expect(() => parseGitHubRepositoryUrl("https://gitlab.com/acme/wallet")).toThrow(
      DomainValidationError,
    );
    expect(() => parseGitHubRepositoryUrl("file:///tmp/wallet")).toThrow(DomainValidationError);
    expect(() => parseGitHubRepositoryUrl("javascript:alert(1)")).toThrow(DomainValidationError);
  });

  it("rejects incomplete or reserved paths", () => {
    expect(() => parseGitHubRepositoryUrl("https://github.com/acme")).toThrow(
      DomainValidationError,
    );
    expect(() => parseGitHubRepositoryUrl("https://github.com/orgs/acme")).toThrow(
      DomainValidationError,
    );
  });
});
