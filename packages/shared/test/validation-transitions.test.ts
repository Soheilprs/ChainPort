import { describe, expect, it } from "vitest";

import {
  assertValidationTransition,
  buildValidationIdempotencyKey,
  InvalidValidationTransitionError,
} from "../src/index.js";

describe("validation transitions", () => {
  it("allows prepare → install → build → test → completed and forbids rewriting completed runs", () => {
    expect(() => assertValidationTransition("QUEUED", "PREPARING")).not.toThrow();
    expect(() => assertValidationTransition("TESTING", "COMPLETED")).not.toThrow();
    expect(() => assertValidationTransition("COMPLETED", "QUEUED")).toThrow(
      InvalidValidationTransitionError,
    );
  });

  it("builds identity from revision, hash, engine, image digest, and profile", () => {
    expect(
      buildValidationIdempotencyKey({
        repositoryRevisionId: "rev-1",
        revisionContentHash: "ABCD",
        engineVersion: "1",
        sandboxImageDigest: "sha256:ff",
        profile: "STANDARD_LOCAL",
      }),
    ).toBe("validation:rev-1:abcd:1:sha256:ff:STANDARD_LOCAL");
  });
});
