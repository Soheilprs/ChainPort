import type { MigrationActionDraft } from "./types.js";

export function mergeDrafts(drafts: readonly MigrationActionDraft[]): MigrationActionDraft[] {
  const byKey = new Map<string, MigrationActionDraft>();
  for (const draft of drafts) {
    const existing = byKey.get(draft.key);
    if (existing === undefined) {
      byKey.set(draft.key, {
        ...draft,
        findingIds: [...draft.findingIds],
        evidence: [...draft.evidence],
        dependsOnKeys: [...draft.dependsOnKeys],
      });
      continue;
    }
    const findingIds = unique([...existing.findingIds, ...draft.findingIds]);
    const evidence = uniqueEvidence([...existing.evidence, ...draft.evidence]);
    const dependsOnKeys = unique([...existing.dependsOnKeys, ...draft.dependsOnKeys]);
    byKey.set(draft.key, { ...existing, findingIds, evidence, dependsOnKeys });
  }
  return [...byKey.values()];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueEvidence(
  evidence: MigrationActionDraft["evidence"],
): MigrationActionDraft["evidence"] {
  const seen = new Set<string>();
  const result: MigrationActionDraft["evidence"] = [];
  for (const item of evidence) {
    const key = `${item.findingId}:${item.filePath}:${item.startLine}:${item.excerpt}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}
