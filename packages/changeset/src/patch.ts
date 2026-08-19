import { lineExcerpt, unifiedDiff } from "./diff.js";
import { sha256Text } from "./hash.js";
import type { GeneratedPatch, PatchContext } from "./types.js";

export function makePatch(
  context: PatchContext,
  patcherId: string,
  patcherVersion: string,
  patchedText: string,
  sourceValue: string,
  targetValue: string,
  reason: string,
): GeneratedPatch {
  const evidenceLine = context.evidence[0]?.startLine ?? 1;
  return {
    filePath: context.filePath,
    patcherId,
    patcherVersion,
    changeType: "REPLACE_VALUE",
    patchedText,
    unifiedDiff: unifiedDiff(context.filePath, context.fileText, patchedText),
    beforeExcerpt: lineExcerpt(context.fileText, evidenceLine),
    afterExcerpt: lineExcerpt(patchedText, evidenceLine),
    sourceHash: sha256Text(context.fileText),
    resultHash: sha256Text(patchedText),
    sourceValue,
    targetValue,
    reason,
  };
}

export function replaceLineValue(
  text: string,
  lineNumber: number,
  source: string,
  target: string,
): string | null {
  const lines = text.split("\n");
  const index = lineNumber - 1;
  const line = lines[index];
  if (line === undefined) {
    return null;
  }
  const occurrences = line.split(source).length - 1;
  if (occurrences !== 1) {
    return null;
  }
  lines[index] = line.replace(source, target);
  return lines.join("\n");
}
