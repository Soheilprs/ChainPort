import type {
  CompatibilityCategory,
  CompatibilityStatus,
  CoverageConfidence,
  JsonObject,
  MigrationActionCategory,
  MigrationActionStatus,
  MigrationAutomationLevel,
  MigrationPlanOutcome,
  MigrationRiskLevel,
  MigrationStage,
  RemediationType,
} from "@chainport/shared";

export interface PlannedEvidence {
  findingId: string;
  evidenceId: string | null;
  filePath: string;
  startLine: number;
  excerpt: string;
}

export interface PlannedFinding {
  id: string;
  requirementId: string | null;
  requirementKey: string | null;
  ruleId: string;
  ruleVersion: string;
  category: CompatibilityCategory;
  status: CompatibilityStatus;
  title: string;
  summary: string;
  technicalReason: string;
  remediationType: RemediationType;
  sourceValue: string | null;
  targetValue: string | null;
  confidence: CoverageConfidence;
  registryEvidence: JsonObject;
  evidence: readonly PlannedEvidence[];
}

export interface PlanContext {
  sourceChainKey: string;
  sourceChainName: string;
  sourceChainId: number;
  targetChainKey: string;
  targetChainName: string;
  targetChainId: number;
  targetRpcUrls: readonly string[];
  targetExplorerUrl: string | null;
  registrySnapshotHash: string;
}

export interface MigrationActionDraft {
  key: string;
  ruleId: string;
  ruleVersion: string;
  title: string;
  description: string;
  technicalReason: string;
  category: MigrationActionCategory;
  stage: MigrationStage;
  automationLevel: MigrationAutomationLevel;
  riskLevel: MigrationRiskLevel;
  actionStatus: MigrationActionStatus;
  sourceValue: string | null;
  targetValue: string | null;
  findingIds: string[];
  evidence: PlannedEvidence[];
  dependsOnKeys: string[];
  registryRefs: JsonObject;
}

export interface MigrationRule {
  id: string;
  version: string;
  supports(finding: PlannedFinding): boolean;
  createActions(finding: PlannedFinding, context: PlanContext): MigrationActionDraft[];
}

export interface OrderedMigrationAction extends MigrationActionDraft {
  displayOrder: number;
  dependencyOrder: number;
}

export interface MigrationPlanResult {
  rulesetVersion: string;
  outcome: MigrationPlanOutcome;
  migrationReady: boolean;
  verificationRequired: boolean;
  autoFixablePercent: number;
  counts: {
    total: number;
    safeAutomatic: number;
    reviewRequired: number;
    manual: number;
    blocked: number;
    unknown: number;
  };
  actions: OrderedMigrationAction[];
  dependencies: Array<{ actionKey: string; dependsOnKey: string }>;
}
