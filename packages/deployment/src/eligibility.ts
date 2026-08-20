import type {
  ChangeSetRecord,
  PlannedMigration,
  RepositoryRevision,
  ValidationRunRecord,
} from "@chainport/shared";

import { DeploymentEngineError } from "./errors.js";

export interface EligibilityInput {
  revision: RepositoryRevision;
  validation: ValidationRunRecord | undefined;
  plan: PlannedMigration | undefined;
  changeSet: ChangeSetRecord | undefined;
}

export interface EligibilityResult {
  eligible: true;
  validation: ValidationRunRecord;
  plan: PlannedMigration;
  changeSet: ChangeSetRecord | null;
}

export function evaluateEligibility(input: EligibilityInput): EligibilityResult {
  if (input.revision.completeness === "PARTIAL") {
    throw new DeploymentEngineError("REVISION_PARTIAL");
  }
  if (input.validation === undefined) {
    throw new DeploymentEngineError("VALIDATION_NOT_PASSED", "Revision has not been validated");
  }
  if (input.validation.repositoryRevisionId !== input.revision.id) {
    throw new DeploymentEngineError("VALIDATION_REVISION_MISMATCH");
  }
  if (input.validation.revisionContentHash !== input.revision.contentHash) {
    throw new DeploymentEngineError("VALIDATION_REVISION_MISMATCH");
  }
  if (input.validation.outcome !== "PASSED" || input.validation.status !== "COMPLETED") {
    throw new DeploymentEngineError("VALIDATION_NOT_PASSED");
  }
  if (input.plan === undefined) {
    throw new DeploymentEngineError(
      "MIGRATION_PLAN_NOT_ELIGIBLE",
      "A completed migration plan is required",
    );
  }
  if (
    input.plan.blockedActionCount > 0 ||
    input.plan.unknownActionCount > 0 ||
    input.plan.manualActionCount > 0 ||
    input.plan.reviewActionCount > 0
  ) {
    throw new DeploymentEngineError("MIGRATION_PLAN_NOT_ELIGIBLE");
  }

  if (input.revision.type === "ORIGINAL") {
    if (input.plan.totalActions !== 0 || input.plan.outcome !== "READY_TO_APPLY") {
      throw new DeploymentEngineError(
        "REVISION_NOT_ELIGIBLE",
        "An original revision is eligible only when the plan has zero actions and is READY_TO_APPLY",
      );
    }
    return {
      eligible: true,
      validation: input.validation,
      plan: input.plan,
      changeSet: null,
    };
  }

  if (input.revision.type !== "GENERATED") {
    throw new DeploymentEngineError("UNSUPPORTED_REVISION");
  }
  if (input.plan.safeActionCount > 0) {
    if (
      input.changeSet === undefined ||
      input.changeSet.status !== "FINALIZED" ||
      input.changeSet.completeness !== "COMPLETE"
    ) {
      throw new DeploymentEngineError("CHANGESET_NOT_FINALIZED");
    }
    if (input.revision.changeSetId !== input.changeSet.id) {
      throw new DeploymentEngineError(
        "REVISION_NOT_ELIGIBLE",
        "Generated revision is not the finalized revision for this migration flow",
      );
    }
  } else if (input.plan.totalActions !== 0) {
    throw new DeploymentEngineError("MIGRATION_PLAN_NOT_ELIGIBLE");
  }

  return {
    eligible: true,
    validation: input.validation,
    plan: input.plan,
    changeSet: input.changeSet ?? null,
  };
}
