import { FUNNEL_STAGES, type FunnelStage } from "@chainport/shared";

export interface StageFlags {
  ingested: boolean;
  analyzed: boolean;
  compatibilityEvaluated: boolean;
  migrationPlanned: boolean;
  safeFixesGenerated: boolean;
  revisionFinalized: boolean;
  validationPassed: boolean;
  deploymentPrepared: boolean;
  testnetDeployed: boolean;
}

export function highestStage(flags: StageFlags): FunnelStage {
  if (flags.testnetDeployed) return "TESTNET_DEPLOYED";
  if (flags.deploymentPrepared) return "TESTNET_DEPLOYMENT_PREPARED";
  if (flags.validationPassed) return "VALIDATION_PASSED";
  if (flags.revisionFinalized) return "REVISION_FINALIZED";
  if (flags.safeFixesGenerated) return "SAFE_FIXES_GENERATED";
  if (flags.migrationPlanned) return "MIGRATION_PLAN_CREATED";
  if (flags.compatibilityEvaluated) return "COMPATIBILITY_EVALUATED";
  if (flags.analyzed) return "REPOSITORY_ANALYZED";
  if (flags.ingested) return "REPOSITORY_INGESTED";
  return "PROJECT_STARTED";
}

export function rank(stage: FunnelStage): number {
  return FUNNEL_STAGES.indexOf(stage);
}

export function cumulativeFunnel(highest: readonly FunnelStage[]): Record<FunnelStage, number> {
  const counts = Object.fromEntries(FUNNEL_STAGES.map((stage) => [stage, 0])) as Record<
    FunnelStage,
    number
  >;
  for (const stage of highest) {
    const reached = rank(stage);
    for (const candidate of FUNNEL_STAGES) {
      if (rank(candidate) <= reached) {
        counts[candidate] += 1;
      }
    }
  }
  return counts;
}

export function conversionRate(numerator: number, denominator: number): number | null {
  if (denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

export function formatRate(value: number | null): string {
  return value === null ? "N/A" : `${(value * 100).toFixed(1)}%`;
}
