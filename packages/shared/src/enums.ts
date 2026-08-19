import { DomainValidationError } from "./errors.js";

export const ORGANIZATION_KINDS = [
  "NETWORK",
  "FOUNDATION",
  "ECOSYSTEM",
  "RAAS",
  "INTERNAL",
] as const;
export type OrganizationKind = (typeof ORGANIZATION_KINDS)[number];

export const PROJECT_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const REPOSITORY_PROVIDERS = ["GITHUB"] as const;
export type RepositoryProvider = (typeof REPOSITORY_PROVIDERS)[number];

export const CLONE_STATUSES = ["PENDING", "CLONING", "READY", "FAILED"] as const;
export type CloneStatus = (typeof CLONE_STATUSES)[number];

export const ANALYSIS_STATUSES = [
  "QUEUED",
  "MATERIALIZING",
  "INVENTORYING",
  "ANALYZING",
  "COMPLETED",
  "FAILED",
] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const FILE_CATEGORIES = [
  "SOLIDITY",
  "TYPESCRIPT",
  "JAVASCRIPT",
  "JSON",
  "TOML",
  "YAML",
  "MARKDOWN",
  "ENV_TEMPLATE",
  "CONFIG",
  "OTHER",
] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

export const REQUIREMENT_CATEGORIES = [
  "NETWORK",
  "TOKEN",
  "ORACLE",
  "PROTOCOL",
  "CROSS_CHAIN",
  "RPC",
  "FRONTEND",
  "CONFIGURATION",
  "FRAMEWORK",
] as const;
export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

export const DETECTION_CONFIDENCES = ["DETECTED", "LIKELY", "UNKNOWN"] as const;
export type DetectionConfidence = (typeof DETECTION_CONFIDENCES)[number];

export const COMPONENT_KINDS = [
  "FRAMEWORK",
  "LANGUAGE",
  "PACKAGE_MANAGER",
  "CONTRACT",
  "INTERFACE",
  "LIBRARY",
  "FRONTEND",
  "DEPENDENCY",
] as const;
export type ComponentKind = (typeof COMPONENT_KINDS)[number];

export const JOB_STATUSES = [
  "QUEUED",
  "INGESTING",
  "ANALYZING",
  "COMPARING",
  "PLANNING",
  "PATCHING",
  "BUILDING",
  "TESTING",
  "DEPLOYING",
  "VERIFYING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STAGE_SEQUENCE = [
  "INGESTING",
  "ANALYZING",
  "COMPARING",
  "PLANNING",
  "PATCHING",
  "BUILDING",
  "TESTING",
  "DEPLOYING",
  "VERIFYING",
] as const;
export type JobStageStatus = (typeof JOB_STAGE_SEQUENCE)[number];

export const TERMINAL_JOB_STATUSES = ["COMPLETED", "FAILED", "CANCELLED"] as const;
export type TerminalJobStatus = (typeof TERMINAL_JOB_STATUSES)[number];

export const FINDING_SEVERITIES = ["PASS", "WARNING", "BLOCKER"] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const COMPATIBILITY_STATUSES = ["PASS", "WARNING", "BLOCKER", "UNKNOWN"] as const;
export type CompatibilityStatus = (typeof COMPATIBILITY_STATUSES)[number];

export const COMPATIBILITY_CATEGORIES = [
  "CONTRACTS",
  "RPC",
  "TOKENS",
  "ORACLES",
  "PROTOCOLS",
  "CROSS_CHAIN",
  "FRONTEND",
  "CONFIGURATION",
] as const;
export type CompatibilityCategory = (typeof COMPATIBILITY_CATEGORIES)[number];

export const COMPATIBILITY_RUN_STATUSES = ["QUEUED", "EVALUATING", "COMPLETED", "FAILED"] as const;
export type CompatibilityRunStatus = (typeof COMPATIBILITY_RUN_STATUSES)[number];

export const COMPATIBILITY_READINESSES = [
  "READY",
  "REVIEW_REQUIRED",
  "BLOCKED",
  "INSUFFICIENT_DATA",
] as const;
export type CompatibilityReadiness = (typeof COMPATIBILITY_READINESSES)[number];

export const REMEDIATION_TYPES = [
  "NONE",
  "CONFIG_CHANGE",
  "ADDRESS_MAPPING",
  "INFRASTRUCTURE_REQUIRED",
  "MANUAL_REVIEW",
  "UNKNOWN",
] as const;
export type RemediationType = (typeof REMEDIATION_TYPES)[number];

export const COVERAGE_CONFIDENCES = ["HIGH", "MEDIUM", "LOW"] as const;
export type CoverageConfidence = (typeof COVERAGE_CONFIDENCES)[number];

export const CAPABILITY_AVAILABILITIES = ["AVAILABLE", "UNAVAILABLE", "UNKNOWN"] as const;
export type CapabilityAvailability = (typeof CAPABILITY_AVAILABILITIES)[number];

export const CAPABILITY_PROVENANCES = ["VERIFIED", "DECLARED", "UNKNOWN"] as const;
export type CapabilityProvenance = (typeof CAPABILITY_PROVENANCES)[number];

export const MIGRATION_PLAN_RUN_STATUSES = ["QUEUED", "PLANNING", "COMPLETED", "FAILED"] as const;
export type MigrationPlanRunStatus = (typeof MIGRATION_PLAN_RUN_STATUSES)[number];

export const MIGRATION_PLAN_OUTCOMES = [
  "READY_TO_APPLY",
  "REVIEW_REQUIRED",
  "BLOCKED",
  "NEEDS_VERIFICATION",
] as const;
export type MigrationPlanOutcome = (typeof MIGRATION_PLAN_OUTCOMES)[number];

export const MIGRATION_AUTOMATION_LEVELS = [
  "SAFE_AUTOMATIC",
  "REVIEW_REQUIRED",
  "MANUAL",
  "BLOCKED",
  "UNKNOWN",
] as const;
export type MigrationAutomationLevel = (typeof MIGRATION_AUTOMATION_LEVELS)[number];

export const MIGRATION_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type MigrationRiskLevel = (typeof MIGRATION_RISK_LEVELS)[number];

export const MIGRATION_ACTION_STATUSES = ["PLANNED", "BLOCKED", "UNKNOWN"] as const;
export type MigrationActionStatus = (typeof MIGRATION_ACTION_STATUSES)[number];

export const MIGRATION_STAGES = [
  "NETWORK_CONFIGURATION",
  "RPC_AND_EXPLORER",
  "TOKEN_MAPPINGS",
  "INFRASTRUCTURE_CONTRACTS",
  "ORACLES",
  "CROSS_CHAIN",
  "CONTRACT_CONFIGURATION",
  "FRONTEND_CONFIGURATION",
  "DEPLOYMENT_CONFIGURATION",
  "MANUAL_REVIEW",
] as const;
export type MigrationStage = (typeof MIGRATION_STAGES)[number];

export const CHANGESET_ENGINE_VERSION = "1";

export const CHANGESET_STATUSES = [
  "QUEUED",
  "MATERIALIZING",
  "GENERATING",
  "READY_FOR_REVIEW",
  "FINALIZING",
  "FINALIZED",
  "FAILED",
  "ROLLED_BACK",
] as const;
export type ChangeSetStatus = (typeof CHANGESET_STATUSES)[number];

export const CHANGE_STATUSES = ["PROPOSED", "ACCEPTED", "REJECTED", "SKIPPED", "FAILED"] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

export const CHANGE_TYPES = ["REPLACE_VALUE"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export const REVISION_TYPES = ["ORIGINAL", "GENERATED"] as const;
export type RevisionType = (typeof REVISION_TYPES)[number];

export const REVISION_COMPLETENESS = ["COMPLETE", "PARTIAL"] as const;
export type RevisionCompleteness = (typeof REVISION_COMPLETENESS)[number];

export const VALIDATION_ENGINE_VERSION = "1";
export const VALIDATION_PROFILE_ID = "STANDARD_LOCAL";
export const VALIDATION_PROFILE_VERSION = "1";

export const VALIDATION_RUN_STATUSES = [
  "QUEUED",
  "PREPARING",
  "INSTALLING",
  "BUILDING",
  "TESTING",
  "COMPLETED",
  "FAILED",
  "TIMED_OUT",
] as const;
export type ValidationRunStatus = (typeof VALIDATION_RUN_STATUSES)[number];

export const VALIDATION_OUTCOMES = [
  "PASSED",
  "FAILED",
  "PARTIAL",
  "UNSUPPORTED",
  "INFRA_FAILURE",
] as const;
export type ValidationOutcome = (typeof VALIDATION_OUTCOMES)[number];

export const VALIDATION_STEP_NAMES = [
  "MATERIALIZE",
  "VERIFY_REVISION",
  "INSTALL",
  "BUILD",
  "TEST",
  "CLEANUP",
] as const;
export type ValidationStepName = (typeof VALIDATION_STEP_NAMES)[number];

export const VALIDATION_STEP_STATUSES = [
  "PENDING",
  "RUNNING",
  "PASSED",
  "FAILED",
  "SKIPPED",
  "TIMED_OUT",
] as const;
export type ValidationStepStatus = (typeof VALIDATION_STEP_STATUSES)[number];

export const VALIDATION_FRAMEWORKS = ["FOUNDRY", "HARDHAT"] as const;
export type ValidationFramework = (typeof VALIDATION_FRAMEWORKS)[number];

export const VALIDATION_PROFILES = ["STANDARD_LOCAL"] as const;
export type ValidationProfile = (typeof VALIDATION_PROFILES)[number];

export const REGRESSION_STATUSES = [
  "NOT_COMPARED",
  "NO_REGRESSION",
  "REGRESSION_DETECTED",
  "BASELINE_ALREADY_FAILING",
  "INCONCLUSIVE",
] as const;
export type RegressionStatus = (typeof REGRESSION_STATUSES)[number];

export const MIGRATION_ACTION_CATEGORIES = [
  "CHAIN_ID",
  "RPC_URL",
  "EXPLORER",
  "ENV_CONFIG",
  "TOKEN_ADDRESS",
  "INFRASTRUCTURE_ADDRESS",
  "ORACLE_FEED",
  "RPC_CAPABILITY",
  "CROSS_CHAIN",
  "FRONTEND_NETWORK",
  "UNKNOWN_ADDRESS",
  "BLOCKED_INFRASTRUCTURE",
] as const;
export type MigrationActionCategory = (typeof MIGRATION_ACTION_CATEGORIES)[number];

export const FINDING_CATEGORIES = [
  "CHAIN_ID",
  "HARDCODED_ADDRESS",
  "RPC",
  "TOKEN",
  "ORACLE",
  "BRIDGE",
  "PRECOMPILE",
  "OPCODE",
  "FRAMEWORK",
  "DEPENDENCY",
  "FRONTEND_CONFIG",
  "PROTOCOL",
  "GAS",
  "FINALITY",
  "INFRASTRUCTURE",
  "OTHER",
] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export const CHAIN_ROLES = ["source", "target"] as const;
export type ChainRole = (typeof CHAIN_ROLES)[number];

export const NETWORK_KINDS = ["mainnet", "testnet", "devnet"] as const;
export type NetworkKind = (typeof NETWORK_KINDS)[number];

export const CHAIN_FAMILIES = [
  "ethereum",
  "op-stack",
  "arbitrum-orbit",
  "polygon-cdk",
  "zk-stack",
  "other",
] as const;
export type ChainFamily = (typeof CHAIN_FAMILIES)[number];

export const EVM_VERSIONS = ["paris", "shanghai", "cancun", "prague"] as const;
export type EvmVersion = (typeof EVM_VERSIONS)[number];

export const INFRASTRUCTURE_STATUSES = ["available", "partial", "missing", "unknown"] as const;
export type InfrastructureStatus = (typeof INFRASTRUCTURE_STATUSES)[number];

export const IMPLEMENTATION_STATUSES = ["not_implemented", "implemented"] as const;
export type ImplementationStatus = (typeof IMPLEMENTATION_STATUSES)[number];

export const DATABASE_PURPOSES = [
  "development",
  "integration-test",
  "validation",
  "customer",
  "production",
] as const;
export type DatabasePurpose = (typeof DATABASE_PURPOSES)[number];

export const INTEGRATION_TEST_DATABASE_PURPOSE = "integration-test" satisfies DatabasePurpose;

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

export function isOrganizationKind(value: unknown): value is OrganizationKind {
  return isOneOf(value, ORGANIZATION_KINDS);
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return isOneOf(value, PROJECT_STATUSES);
}

export function isRepositoryProvider(value: unknown): value is RepositoryProvider {
  return isOneOf(value, REPOSITORY_PROVIDERS);
}

export function isCloneStatus(value: unknown): value is CloneStatus {
  return isOneOf(value, CLONE_STATUSES);
}

export function isAnalysisStatus(value: unknown): value is AnalysisStatus {
  return isOneOf(value, ANALYSIS_STATUSES);
}

export function isFileCategory(value: unknown): value is FileCategory {
  return isOneOf(value, FILE_CATEGORIES);
}

export function isRequirementCategory(value: unknown): value is RequirementCategory {
  return isOneOf(value, REQUIREMENT_CATEGORIES);
}

export function isDetectionConfidence(value: unknown): value is DetectionConfidence {
  return isOneOf(value, DETECTION_CONFIDENCES);
}

export function isJobStatus(value: unknown): value is JobStatus {
  return isOneOf(value, JOB_STATUSES);
}

export function isJobStageStatus(value: unknown): value is JobStageStatus {
  return isOneOf(value, JOB_STAGE_SEQUENCE);
}

export function isTerminalJobStatus(value: unknown): value is TerminalJobStatus {
  return isOneOf(value, TERMINAL_JOB_STATUSES);
}

export function isFindingSeverity(value: unknown): value is FindingSeverity {
  return isOneOf(value, FINDING_SEVERITIES);
}

export function isCompatibilityStatus(value: unknown): value is CompatibilityStatus {
  return isOneOf(value, COMPATIBILITY_STATUSES);
}

export function isCompatibilityCategory(value: unknown): value is CompatibilityCategory {
  return isOneOf(value, COMPATIBILITY_CATEGORIES);
}

export function isCompatibilityRunStatus(value: unknown): value is CompatibilityRunStatus {
  return isOneOf(value, COMPATIBILITY_RUN_STATUSES);
}

export function isCompatibilityReadiness(value: unknown): value is CompatibilityReadiness {
  return isOneOf(value, COMPATIBILITY_READINESSES);
}

export function isRemediationType(value: unknown): value is RemediationType {
  return isOneOf(value, REMEDIATION_TYPES);
}

export function isCoverageConfidence(value: unknown): value is CoverageConfidence {
  return isOneOf(value, COVERAGE_CONFIDENCES);
}

export function isCapabilityAvailability(value: unknown): value is CapabilityAvailability {
  return isOneOf(value, CAPABILITY_AVAILABILITIES);
}

export function isCapabilityProvenance(value: unknown): value is CapabilityProvenance {
  return isOneOf(value, CAPABILITY_PROVENANCES);
}

export function isMigrationPlanRunStatus(value: unknown): value is MigrationPlanRunStatus {
  return isOneOf(value, MIGRATION_PLAN_RUN_STATUSES);
}

export function isMigrationPlanOutcome(value: unknown): value is MigrationPlanOutcome {
  return isOneOf(value, MIGRATION_PLAN_OUTCOMES);
}

export function isMigrationAutomationLevel(value: unknown): value is MigrationAutomationLevel {
  return isOneOf(value, MIGRATION_AUTOMATION_LEVELS);
}

export function isMigrationRiskLevel(value: unknown): value is MigrationRiskLevel {
  return isOneOf(value, MIGRATION_RISK_LEVELS);
}

export function isMigrationActionStatus(value: unknown): value is MigrationActionStatus {
  return isOneOf(value, MIGRATION_ACTION_STATUSES);
}

export function isMigrationStage(value: unknown): value is MigrationStage {
  return isOneOf(value, MIGRATION_STAGES);
}

export function isMigrationActionCategory(value: unknown): value is MigrationActionCategory {
  return isOneOf(value, MIGRATION_ACTION_CATEGORIES);
}

export function isChangeSetStatus(value: unknown): value is ChangeSetStatus {
  return isOneOf(value, CHANGESET_STATUSES);
}

export function isChangeStatus(value: unknown): value is ChangeStatus {
  return isOneOf(value, CHANGE_STATUSES);
}

export function isRevisionType(value: unknown): value is RevisionType {
  return isOneOf(value, REVISION_TYPES);
}

export function isValidationRunStatus(value: unknown): value is ValidationRunStatus {
  return isOneOf(value, VALIDATION_RUN_STATUSES);
}

export function isValidationOutcome(value: unknown): value is ValidationOutcome {
  return isOneOf(value, VALIDATION_OUTCOMES);
}

export function isValidationFramework(value: unknown): value is ValidationFramework {
  return isOneOf(value, VALIDATION_FRAMEWORKS);
}

export function isRegressionStatus(value: unknown): value is RegressionStatus {
  return isOneOf(value, REGRESSION_STATUSES);
}

export function isFindingCategory(value: unknown): value is FindingCategory {
  return isOneOf(value, FINDING_CATEGORIES);
}

export function isChainRole(value: unknown): value is ChainRole {
  return isOneOf(value, CHAIN_ROLES);
}

export function isNetworkKind(value: unknown): value is NetworkKind {
  return isOneOf(value, NETWORK_KINDS);
}

export function isChainFamily(value: unknown): value is ChainFamily {
  return isOneOf(value, CHAIN_FAMILIES);
}

export function isEvmVersion(value: unknown): value is EvmVersion {
  return isOneOf(value, EVM_VERSIONS);
}

export function isInfrastructureStatus(value: unknown): value is InfrastructureStatus {
  return isOneOf(value, INFRASTRUCTURE_STATUSES);
}

export function isDatabasePurpose(value: unknown): value is DatabasePurpose {
  return isOneOf(value, DATABASE_PURPOSES);
}

function parseEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (!isOneOf(value, allowed)) {
    throw new DomainValidationError(`${field} is invalid`);
  }
  return value;
}

export function parseOrganizationKind(value: unknown): OrganizationKind {
  return parseEnum(value, ORGANIZATION_KINDS, "kind");
}

export function parseProjectStatus(value: unknown): ProjectStatus {
  return parseEnum(value, PROJECT_STATUSES, "status");
}

export function parseJobStatus(value: unknown): JobStatus {
  return parseEnum(value, JOB_STATUSES, "status");
}

export function parseFindingSeverity(value: unknown): FindingSeverity {
  return parseEnum(value, FINDING_SEVERITIES, "severity");
}

export function parseCompatibilityStatus(value: unknown): CompatibilityStatus {
  return parseEnum(value, COMPATIBILITY_STATUSES, "status");
}

export function parseCompatibilityCategory(value: unknown): CompatibilityCategory {
  return parseEnum(value, COMPATIBILITY_CATEGORIES, "category");
}

export function parseCompatibilityRunStatus(value: unknown): CompatibilityRunStatus {
  return parseEnum(value, COMPATIBILITY_RUN_STATUSES, "status");
}

export function parseCompatibilityReadiness(value: unknown): CompatibilityReadiness {
  return parseEnum(value, COMPATIBILITY_READINESSES, "readiness");
}

export function parseRemediationType(value: unknown): RemediationType {
  return parseEnum(value, REMEDIATION_TYPES, "remediationType");
}

export function parseMigrationPlanRunStatus(value: unknown): MigrationPlanRunStatus {
  return parseEnum(value, MIGRATION_PLAN_RUN_STATUSES, "status");
}

export function parseMigrationPlanOutcome(value: unknown): MigrationPlanOutcome {
  return parseEnum(value, MIGRATION_PLAN_OUTCOMES, "outcome");
}

export function parseMigrationAutomationLevel(value: unknown): MigrationAutomationLevel {
  return parseEnum(value, MIGRATION_AUTOMATION_LEVELS, "automationLevel");
}

export function parseMigrationRiskLevel(value: unknown): MigrationRiskLevel {
  return parseEnum(value, MIGRATION_RISK_LEVELS, "riskLevel");
}

export function parseFindingCategory(value: unknown): FindingCategory {
  return parseEnum(value, FINDING_CATEGORIES, "category");
}

export function parseChainRole(value: unknown): ChainRole {
  return parseEnum(value, CHAIN_ROLES, "role");
}

export function parseNetworkKind(value: unknown): NetworkKind {
  return parseEnum(value, NETWORK_KINDS, "networkKind");
}

export function parseChainFamily(value: unknown): ChainFamily {
  return parseEnum(value, CHAIN_FAMILIES, "family");
}

export function parseEvmVersion(value: unknown): EvmVersion {
  return parseEnum(value, EVM_VERSIONS, "evmVersion");
}

export function parseInfrastructureStatus(value: unknown): InfrastructureStatus {
  return parseEnum(value, INFRASTRUCTURE_STATUSES, "status");
}

export function parseDatabasePurpose(value: unknown): DatabasePurpose {
  return parseEnum(value, DATABASE_PURPOSES, "databasePurpose");
}
