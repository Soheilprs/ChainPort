import type { InfrastructureGapKind } from "@chainport/shared";

const PROJECT_CONFIG_RULES = new Set(["chain-id", "hardcoded-rpc", "env-config"]);

export interface GapFindingInput {
  ruleId: string;
  status: string;
  category: string;
  remediationType: string;
  sourceValue: string | null;
  targetValue: string | null;
  title: string;
}

export function classifyFinding(finding: GapFindingInput): InfrastructureGapKind | null {
  if (finding.status === "PASS") {
    return null;
  }
  if (PROJECT_CONFIG_RULES.has(finding.ruleId)) {
    return "PROJECT_CONFIG";
  }
  if (finding.status === "UNKNOWN" || finding.targetValue === "UNKNOWN") {
    return "UNKNOWN_NETWORK_DATA";
  }
  if (
    finding.remediationType === "INFRASTRUCTURE_REQUIRED" ||
    finding.targetValue === "UNAVAILABLE"
  ) {
    return "NETWORK_GAP";
  }
  if (
    finding.remediationType === "CONFIG_CHANGE" ||
    finding.remediationType === "ADDRESS_MAPPING"
  ) {
    return "PROJECT_CONFIG";
  }
  if (finding.remediationType === "MANUAL_REVIEW") {
    return "MIGRATION_REVIEW";
  }
  if (finding.status === "BLOCKER") {
    return "NETWORK_GAP";
  }
  return "MIGRATION_REVIEW";
}

export function isInfrastructureGap(kind: InfrastructureGapKind | null): boolean {
  return kind === "NETWORK_GAP" || kind === "UNKNOWN_NETWORK_DATA";
}

export function semanticCapabilityKey(finding: GapFindingInput): string {
  const value = (finding.sourceValue ?? finding.targetValue ?? finding.title).trim();
  if (finding.ruleId === "oracle-availability") {
    return normalizeOracleKey(value);
  }
  if (finding.ruleId === "token-availability") {
    return `token:${value.toUpperCase()}`;
  }
  if (finding.ruleId === "layerzero") {
    return "protocol:LAYERZERO";
  }
  if (finding.ruleId === "rpc-capability") {
    return `rpc:${value}`;
  }
  if (finding.ruleId === "infrastructure-contract") {
    return `infra:${value.toUpperCase()}`;
  }
  if (finding.ruleId === "uniswap") {
    return "protocol:UNISWAP";
  }
  return `${finding.ruleId}:${value}`;
}

export function gapPriority(blockerProjects: number, unknownProjects: number): number {
  return 3 * blockerProjects + unknownProjects;
}

function normalizeOracleKey(value: string): string {
  const upper = value.toUpperCase();
  if (upper.includes("ETH/USD") || upper.includes("ETH-USD")) {
    return "oracle:CHAINLINK_PRICE_FEED:ETH/USD";
  }
  if (upper.startsWith("CHAINLINK_PRICE_FEED:")) {
    return `oracle:${upper}`;
  }
  if (upper.includes("CHAINLINK")) {
    return "oracle:CHAINLINK";
  }
  return `oracle:${upper}`;
}
