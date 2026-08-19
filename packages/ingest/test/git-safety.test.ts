import { describe, expect, it } from "vitest";

import { githubHttpsCloneUrl, parseGitHubRepositoryUrl } from "@chainport/shared";

import { classifyGitFailure } from "../src/index.js";

describe("clone source safety", () => {
  it("never uses the user-supplied URL as the git remote", () => {
    const sneaky = "https://github.com/acme/wallet.git?ignore=1";
    const ref = parseGitHubRepositoryUrl(sneaky);
    expect(githubHttpsCloneUrl(ref)).toBe("https://github.com/acme/wallet.git");
    expect(githubHttpsCloneUrl(ref)).not.toContain("?");
  });
});

describe("git failure classification", () => {
  it("maps missing repositories to a deterministic error", () => {
    expect(classifyGitFailure("ERROR: Repository not found.")).toMatchObject({
      code: "REPOSITORY_NOT_FOUND",
      retryable: false,
    });
  });
});
