import { makePatch } from "../patch.js";
import { isSafeEnvTemplate, isUnsafeEnvFile } from "../paths.js";
import type { PatchSkip, SafePatcher } from "../types.js";
import { extractReplaceable, parseEnvAssignment } from "../values.js";

export const envTemplatePatcher: SafePatcher = {
  id: "env-template",
  version: "1",
  supports(context) {
    return isSafeEnvTemplate(context.filePath);
  },
  generate(context) {
    if (isUnsafeEnvFile(context.filePath)) {
      return skip("UNSAFE_ENV_FILE", "Secret-bearing env files are not auto-patched");
    }
    if (!isSafeEnvTemplate(context.filePath)) {
      return skip("UNSAFE_ENV_FILE", "Only env templates may be patched");
    }
    const replaceable = extractReplaceable(context.action);
    if (replaceable === null) {
      return skip("PATCH_PRECONDITION_FAILED", "Missing source or target value");
    }
    const key =
      replaceable.envKey ??
      parseEnvAssignment(context.action.sourceValue ?? "")?.key ??
      parseEnvAssignment(context.evidence[0]?.excerpt ?? "")?.key;
    if (key === undefined || key === null) {
      return skip("PATCH_PRECONDITION_FAILED", "Could not determine env key");
    }
    const lines = context.fileText.split("\n");
    let matched = 0;
    let index = -1;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      if (line.startsWith(`${key}=`)) {
        matched += 1;
        index = i;
      }
    }
    if (matched !== 1 || index < 0) {
      return skip("SOURCE_MISMATCH", `Env key ${key} was not found exactly once`);
    }
    const current = parseEnvAssignment(lines[index] ?? "");
    if (current === null) {
      return skip("SOURCE_MISMATCH", "Env line is not a key=value assignment");
    }
    if (replaceable.source.length > 0 && current.value !== replaceable.source) {
      return skip("SOURCE_MISMATCH", "Env value does not match migration evidence");
    }
    const next = [...lines];
    next[index] = `${key}=${replaceable.target}`;
    return makePatch(
      context,
      this.id,
      this.version,
      next.join("\n"),
      current.value,
      replaceable.target,
      `Replace ${key} in env template`,
    );
  },
};

function skip(code: string, reason: string): PatchSkip {
  return { skip: true, code, reason };
}
