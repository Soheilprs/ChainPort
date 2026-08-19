import type { RegressionStatus, ValidationOutcome, ValidationRunRecord } from "@chainport/shared";

export function compareValidations(
  original: ValidationRunRecord | null,
  generated: ValidationRunRecord | null,
): { regressionStatus: RegressionStatus; summary: string } {
  if (original === null || generated === null) {
    return {
      regressionStatus: "NOT_COMPARED",
      summary: "Both original and generated validations are required",
    };
  }
  if (original.outcome === "INFRA_FAILURE" || generated.outcome === "INFRA_FAILURE") {
    return { regressionStatus: "INCONCLUSIVE", summary: "A platform failure prevents comparison" };
  }
  if (original.outcome === "UNSUPPORTED" || generated.outcome === "UNSUPPORTED") {
    return {
      regressionStatus: "INCONCLUSIVE",
      summary: "A revision is unsupported in this validation profile",
    };
  }
  if (original.outcome === "PARTIAL" || generated.outcome === "PARTIAL") {
    return { regressionStatus: "INCONCLUSIVE", summary: "A revision completed only partially" };
  }
  const originalPass = original.outcome === "PASSED";
  const generatedPass = generated.outcome === "PASSED";
  if (!originalPass && !generatedPass) {
    return {
      regressionStatus: "BASELINE_ALREADY_FAILING",
      summary: "Original revision already failed validation",
    };
  }
  if (originalPass && generatedPass) {
    return { regressionStatus: "NO_REGRESSION", summary: "Safe changes preserved validation" };
  }
  if (originalPass && !generatedPass) {
    return {
      regressionStatus: "REGRESSION_DETECTED",
      summary: "Generated revision failed after a passing original",
    };
  }
  return { regressionStatus: "INCONCLUSIVE", summary: "Generated passed while original failed" };
}

export function outcomeRank(outcome: ValidationOutcome | null): number {
  if (outcome === "PASSED") return 2;
  if (outcome === "PARTIAL") return 1;
  return 0;
}
