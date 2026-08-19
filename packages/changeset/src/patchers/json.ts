import { makePatch } from "../patch.js";
import type { PatchSkip, SafePatcher } from "../types.js";
import { extractReplaceable } from "../values.js";

export const jsonConfigPatcher: SafePatcher = {
  id: "json-config",
  version: "1",
  supports(context) {
    return context.filePath.endsWith(".json");
  },
  generate(context) {
    try {
      JSON.parse(context.fileText);
    } catch {
      return skip("PATCHER_UNSUPPORTED", "JSON is malformed");
    }
    const replaceable = extractReplaceable(context.action);
    if (replaceable === null) {
      return skip("PATCH_PRECONDITION_FAILED", "Missing source or target value");
    }
    const token = jsonToken(replaceable.source);
    const nextToken = jsonToken(replaceable.target);
    const occurrences = context.fileText.split(token).length - 1;
    if (occurrences !== 1) {
      return skip("PATCH_PRECONDITION_FAILED", "JSON source value is not unique");
    }
    const patched = context.fileText.replace(token, nextToken);
    try {
      JSON.parse(patched);
    } catch {
      return skip("PATCH_PRECONDITION_FAILED", "Patched JSON would be invalid");
    }
    return makePatch(
      context,
      this.id,
      this.version,
      patched,
      replaceable.source,
      replaceable.target,
      "Replace unique JSON scalar",
    );
  },
};

function jsonToken(value: string): string {
  if (/^\d+$/.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function skip(code: string, reason: string): PatchSkip {
  return { skip: true, code, reason };
}
