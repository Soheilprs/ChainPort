import { describe, expect, it } from "vitest";

import {
  DomainValidationError,
  githubApiRepositoryUrl,
  githubHttpsCloneUrl,
  parseGitHubRepositoryUrl,
} from "../src/index.js";

describe("parseGitHubRepositoryUrl", () => {
  it("normalizes https, trailing slash, and .git", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/acme/wallet.git/")).toEqual({
      host: "github.com",
      owner: "acme",
      repo: "wallet",
      url: "https://github.com/acme/wallet",
    });
  });

  it("accepts host-only forms", () => {
    expect(parseGitHubRepositoryUrl("github.com/acme/wallet").owner).toBe("acme");
  });

  it("extracts owner and repo from tree URLs", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/acme/wallet/tree/main").repo).toBe(
      "wallet",
    );
  });

  it("constructs trusted clone and API URLs from parsed components", () => {
    const ref = parseGitHubRepositoryUrl("https://github.com/acme/wallet.git");
    expect(githubHttpsCloneUrl(ref)).toBe("https://github.com/acme/wallet.git");
    expect(githubApiRepositoryUrl("https://api.github.com", ref)).toBe(
      "https://api.github.com/repos/acme/wallet",
    );
    expect(() => githubApiRepositoryUrl("https://evil.example", ref)).toThrow(/GitHub API/);
  });

  it("rejects non-GitHub hosts, lookalikes, and unsafe schemes", () => {
    expect(() => parseGitHubRepositoryUrl("https://gitlab.com/acme/wallet")).toThrow(
      DomainValidationError,
    );
    expect(() => parseGitHubRepositoryUrl("https://github.com.evil.example/acme/wallet")).toThrow(
      /only github.com/,
    );
    expect(() => parseGitHubRepositoryUrl("https://github.com@evil.example/acme/wallet")).toThrow(
      /credentials/,
    );
    expect(() => parseGitHubRepositoryUrl("file:///tmp/wallet")).toThrow(DomainValidationError);
    expect(() => parseGitHubRepositoryUrl("javascript:alert(1)")).toThrow(DomainValidationError);
  });

  it("rejects credentials, SSH, and custom ports", () => {
    expect(() => parseGitHubRepositoryUrl("https://user:token@github.com/acme/wallet")).toThrow(
      /credentials/,
    );
    expect(() => parseGitHubRepositoryUrl("git@github.com:acme/wallet.git")).toThrow(/SSH/);
    expect(() => parseGitHubRepositoryUrl("ssh://git@github.com/acme/wallet.git")).toThrow(/SSH/);
    expect(() => parseGitHubRepositoryUrl("https://github.com:8443/acme/wallet")).toThrow(
      /custom port/,
    );
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
