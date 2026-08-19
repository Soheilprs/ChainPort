import { describe, expect, it } from "vitest";

import {
  assertChangeSetTransition,
  buildChangeSetIdempotencyKey,
  InvalidChangeSetTransitionError,
} from "../src/index.js";

describe("changeset transitions", () => {
  it("allows generate → review → finalize and forbids rewriting finalized sets", () => {
    expect(() => assertChangeSetTransition("QUEUED", "MATERIALIZING")).not.toThrow();
    expect(() => assertChangeSetTransition("READY_FOR_REVIEW", "FINALIZING")).not.toThrow();
    expect(() => assertChangeSetTransition("FINALIZED", "ROLLED_BACK")).not.toThrow();
    expect(() => assertChangeSetTransition("FINALIZED", "READY_FOR_REVIEW")).toThrow(
      InvalidChangeSetTransitionError,
    );
  });

  it("builds identity from plan, SHA, and engine version", () => {
    expect(
      buildChangeSetIdempotencyKey({
        migrationPlanId: "plan-1",
        originalCommitSha: "AAAAAAAA",
        engineVersion: "1",
      }),
    ).toBe("changeset:plan-1:aaaaaaaa:1");
  });
});
