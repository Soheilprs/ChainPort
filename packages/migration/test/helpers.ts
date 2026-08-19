import type { CompatibilityStatus } from "@chainport/shared";

import type { PlanContext, PlannedFinding } from "../src/types.js";

let seq = 0;

export function context(partial: Partial<PlanContext> = {}): PlanContext {
  return {
    sourceChainKey: "base",
    sourceChainName: "Base",
    sourceChainId: 8453,
    targetChainKey: "optimism",
    targetChainName: "OP Mainnet",
    targetChainId: 10,
    targetRpcUrls: ["https://mainnet.optimism.io"],
    targetExplorerUrl: "https://optimistic.etherscan.io",
    registrySnapshotHash: "snap",
    ...partial,
  };
}

export function finding(
  input: Partial<PlannedFinding> &
    Pick<PlannedFinding, "ruleId" | "status" | "title"> & {
      sourceValue?: string | null;
      targetValue?: string | null;
    },
): PlannedFinding {
  seq += 1;
  return {
    id: input.id ?? `finding-${seq}`,
    requirementId: input.requirementId ?? `req-${seq}`,
    requirementKey: input.requirementKey ?? null,
    ruleId: input.ruleId,
    ruleVersion: input.ruleVersion ?? "1",
    category: input.category ?? "CONFIGURATION",
    status: input.status,
    title: input.title,
    summary: input.summary ?? input.title,
    technicalReason: input.technicalReason ?? input.title,
    remediationType: input.remediationType ?? "CONFIG_CHANGE",
    sourceValue: input.sourceValue ?? null,
    targetValue: input.targetValue ?? null,
    confidence: input.confidence ?? "HIGH",
    registryEvidence: input.registryEvidence ?? {},
    evidence: input.evidence ?? [
      {
        findingId: input.id ?? `finding-${seq}`,
        evidenceId: `ev-${seq}`,
        filePath: "src/config.ts",
        startLine: 19,
        excerpt: input.title,
      },
    ],
  };
}

export function warning(
  ruleId: string,
  title: string,
  extra: Partial<PlannedFinding> = {},
): PlannedFinding {
  return finding({ ruleId, status: "WARNING" as CompatibilityStatus, title, ...extra });
}
