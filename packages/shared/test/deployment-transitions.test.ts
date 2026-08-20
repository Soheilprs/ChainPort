import { describe, expect, it } from "vitest";

import {
  assertDeploymentTransition,
  buildDeploymentPrepareKey,
  hasBroadcastSideEffect,
  InvalidDeploymentTransitionError,
} from "../src/index.js";

describe("deployment transitions", () => {
  it("keeps prepare separate from broadcast and forbids rerunning completed deployments", () => {
    expect(() => assertDeploymentTransition("QUEUED", "CHECKING_ELIGIBILITY")).not.toThrow();
    expect(() => assertDeploymentTransition("SIMULATING", "PREPARED")).not.toThrow();
    expect(() => assertDeploymentTransition("PREPARED", "FUNDING")).not.toThrow();
    expect(() => assertDeploymentTransition("PREPARED", "BROADCASTING")).toThrow(
      InvalidDeploymentTransitionError,
    );
    expect(() => assertDeploymentTransition("COMPLETED", "QUEUED")).toThrow(
      InvalidDeploymentTransitionError,
    );
    expect(() => assertDeploymentTransition("BROADCASTING", "QUEUED")).toThrow(
      InvalidDeploymentTransitionError,
    );
  });

  it("treats broadcasting as the irreversible boundary", () => {
    expect(hasBroadcastSideEffect("PREPARED")).toBe(false);
    expect(hasBroadcastSideEffect("FUNDING")).toBe(false);
    expect(hasBroadcastSideEffect("BROADCASTING")).toBe(true);
    expect(hasBroadcastSideEffect("RECONCILIATION_REQUIRED")).toBe(true);
  });

  it("builds prepare identity without treating deployment as a pure calculation", () => {
    expect(
      buildDeploymentPrepareKey({
        repositoryRevisionId: "rev-1",
        revisionContentHash: "ABCD",
        targetTestnetKey: "optimism-sepolia",
        deploymentProfileVersion: "1",
        deploymentEngineVersion: "1",
        deploymentCandidateId: "cand-1",
      }),
    ).toBe("deployment:rev-1:abcd:optimism-sepolia:1:1:cand-1");
  });
});
