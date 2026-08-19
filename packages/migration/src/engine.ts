import { mergeDrafts } from "./dedupe.js";
import { orderActions } from "./ordering.js";
import { MIGRATION_RULES } from "./rules/index.js";
import { autoFixablePercent, countActions, determinePlanOutcome } from "./status.js";
import type {
  MigrationActionDraft,
  MigrationPlanResult,
  PlanContext,
  PlannedFinding,
} from "./types.js";
import { MIGRATION_RULESET_VERSION } from "./version.js";

export interface CreateMigrationPlanInput {
  context: PlanContext;
  findings: readonly PlannedFinding[];
}

function resolvedDependencies(
  keys: ReadonlySet<string>,
  actions: { key: string; dependsOnKeys: string[] }[],
): Array<{ actionKey: string; dependsOnKey: string }> {
  const edges: Array<{ actionKey: string; dependsOnKey: string }> = [];
  for (const action of actions) {
    for (const dependsOnKey of action.dependsOnKeys) {
      if (keys.has(dependsOnKey) && dependsOnKey !== action.key) {
        edges.push({ actionKey: action.key, dependsOnKey });
      }
    }
  }
  return edges;
}

export function createMigrationPlan(input: CreateMigrationPlanInput): MigrationPlanResult {
  const drafts: MigrationActionDraft[] = [];
  for (const finding of input.findings) {
    if (finding.status === "PASS") {
      continue;
    }
    const rule = MIGRATION_RULES.find((item) => item.supports(finding));
    if (rule === undefined) {
      continue;
    }
    drafts.push(...rule.createActions(finding, input.context));
  }
  const merged = mergeDrafts(drafts);
  const keys = new Set(merged.map((item) => item.key));
  const dependencies = resolvedDependencies(keys, merged);
  const actions = orderActions(merged, dependencies);
  const counts = countActions(actions);
  const outcome = determinePlanOutcome(counts);
  return {
    rulesetVersion: MIGRATION_RULESET_VERSION,
    outcome,
    migrationReady: counts.blocked === 0 && counts.unknown === 0,
    verificationRequired: counts.unknown > 0,
    autoFixablePercent: autoFixablePercent(counts),
    counts,
    actions,
    dependencies,
  };
}
