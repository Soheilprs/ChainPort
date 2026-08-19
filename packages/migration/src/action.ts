import type { JsonObject } from "@chainport/shared";

import type { MigrationActionDraft, PlannedFinding } from "./types.js";

export function evidenceFrom(finding: PlannedFinding) {
  if (finding.evidence.length > 0) {
    return finding.evidence.map((item) => ({ ...item, findingId: finding.id }));
  }
  return [
    {
      findingId: finding.id,
      evidenceId: null,
      filePath: "",
      startLine: 0,
      excerpt: finding.summary,
    },
  ];
}

export function jsonList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

export function looksLikeAddress(value: string | null): boolean {
  return value !== null && /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function draft(
  partial: Omit<
    MigrationActionDraft,
    "findingIds" | "evidence" | "dependsOnKeys" | "registryRefs"
  > & {
    finding: PlannedFinding;
    dependsOnKeys?: string[];
    registryRefs?: JsonObject;
  },
): MigrationActionDraft {
  const { finding, dependsOnKeys, registryRefs, ...rest } = partial;
  return {
    ...rest,
    findingIds: [finding.id],
    evidence: evidenceFrom(finding),
    dependsOnKeys: dependsOnKeys ?? [],
    registryRefs: registryRefs ?? finding.registryEvidence,
  };
}
