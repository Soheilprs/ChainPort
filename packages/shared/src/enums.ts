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
