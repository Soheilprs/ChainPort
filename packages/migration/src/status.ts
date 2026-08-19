import type { MigrationPlanOutcome } from "@chainport/shared";

import type { MigrationActionDraft } from "./types.js";

export function countActions(actions: readonly MigrationActionDraft[]) {
  return {
    total: actions.length,
    safeAutomatic: actions.filter((item) => item.automationLevel === "SAFE_AUTOMATIC").length,
    reviewRequired: actions.filter((item) => item.automationLevel === "REVIEW_REQUIRED").length,
    manual: actions.filter((item) => item.automationLevel === "MANUAL").length,
    blocked: actions.filter((item) => item.automationLevel === "BLOCKED").length,
    unknown: actions.filter((item) => item.automationLevel === "UNKNOWN").length,
  };
}

export function determinePlanOutcome(counts: {
  total: number;
  reviewRequired: number;
  manual: number;
  blocked: number;
  unknown: number;
}): MigrationPlanOutcome {
  if (counts.blocked > 0) {
    return "BLOCKED";
  }
  if (counts.unknown > 0) {
    return "NEEDS_VERIFICATION";
  }
  if (counts.reviewRequired > 0 || counts.manual > 0) {
    return "REVIEW_REQUIRED";
  }
  return "READY_TO_APPLY";
}

export function autoFixablePercent(counts: {
  total: number;
  safeAutomatic: number;
  blocked: number;
  unknown: number;
}): number {
  if (counts.total === 0) {
    return 100;
  }
  const actionable = counts.total - counts.blocked - counts.unknown;
  if (actionable <= 0) {
    return 0;
  }
  return Math.round((100 * counts.safeAutomatic) / actionable);
}
