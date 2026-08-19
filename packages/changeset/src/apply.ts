import { generatePatch } from "./engine.js";
import { makePatch } from "./patch.js";
import { isSkip, type GeneratedPatch, type PatchableAction, type PatchSkip } from "./types.js";
import { extractReplaceable } from "./values.js";

export function applyPatchToWorkingText(input: {
  action: PatchableAction;
  filePath: string;
  fileText: string;
}): GeneratedPatch | PatchSkip {
  const result = generatePatch(input);
  if (!isSkip(result)) {
    return result;
  }
  const replaceable = extractReplaceable(input.action);
  if (replaceable === null) {
    return result;
  }
  const evidenceLine = input.action.evidence.find(
    (item) => item.filePath === input.filePath,
  )?.startLine;
  const line =
    evidenceLine === undefined
      ? undefined
      : input.fileText.split("\n")[Math.max(0, evidenceLine - 1)];
  if (line === undefined) {
    return result;
  }
  if (line.includes(replaceable.target) && !line.includes(replaceable.source)) {
    return makePatch(
      {
        action: input.action,
        filePath: input.filePath,
        fileText: input.fileText,
        evidence: input.action.evidence.filter((item) => item.filePath === input.filePath),
      },
      "already-applied",
      "1",
      input.fileText,
      replaceable.source,
      replaceable.target,
      "Target value is already present on the evidence line",
    );
  }
  return result;
}
