import { MIGRATION_STAGES, type MigrationAutomationLevel } from "@chainport/shared";

import { topologicalOrder } from "./dependencies.js";
import type { MigrationActionDraft, OrderedMigrationAction } from "./types.js";

const AUTOMATION_RANK: Record<MigrationAutomationLevel, number> = {
  BLOCKED: 0,
  UNKNOWN: 1,
  MANUAL: 2,
  REVIEW_REQUIRED: 3,
  SAFE_AUTOMATIC: 4,
};

export function orderActions(
  actions: readonly MigrationActionDraft[],
  dependencies: readonly { actionKey: string; dependsOnKey: string }[],
): OrderedMigrationAction[] {
  const keys = actions.map((item) => item.key);
  const topo = topologicalOrder(keys, dependencies);
  const topoIndex = new Map(topo.map((key, index) => [key, index]));
  const sorted = [...actions].sort((left, right) => {
    const auto = AUTOMATION_RANK[left.automationLevel] - AUTOMATION_RANK[right.automationLevel];
    if (auto !== 0) {
      return auto;
    }
    const stage = MIGRATION_STAGES.indexOf(left.stage) - MIGRATION_STAGES.indexOf(right.stage);
    if (stage !== 0) {
      return stage;
    }
    return left.title.localeCompare(right.title) || left.key.localeCompare(right.key);
  });
  return sorted.map((action, displayOrder) => ({
    ...action,
    displayOrder,
    dependencyOrder: topoIndex.get(action.key) ?? displayOrder,
  }));
}
