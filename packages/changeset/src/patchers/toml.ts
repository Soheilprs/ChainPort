import { parse } from "smol-toml";

import { makePatch, replaceLineValue } from "../patch.js";
import type { PatchSkip, SafePatcher } from "../types.js";
import { extractReplaceable } from "../values.js";

const FORBIDDEN = /(optimizer|solc|via_ir|ffi|fs_permissions|fs_permissions|fuzz|invariant)/i;

export const tomlConfigPatcher: SafePatcher = {
  id: "toml-config",
  version: "1",
  supports(context) {
    return context.filePath.endsWith(".toml") || context.filePath.endsWith("foundry.toml");
  },
  generate(context) {
    const replaceable = extractReplaceable(context.action);
    if (replaceable === null) {
      return skip("PATCH_PRECONDITION_FAILED", "Missing source or target value");
    }
    const line = context.evidence[0]?.startLine;
    if (line === undefined) {
      return skip("PATCHER_UNSUPPORTED", "TOML patches require an evidence line");
    }
    const current = context.fileText.split("\n")[line - 1] ?? "";
    if (FORBIDDEN.test(current)) {
      return skip("PATCHER_UNSUPPORTED", "Compiler and fork settings are not auto-patched");
    }
    if (!current.includes(replaceable.source)) {
      return skip("SOURCE_MISMATCH", "TOML evidence line does not contain the source value");
    }
    const patched = replaceLineValue(
      context.fileText,
      line,
      replaceable.source,
      replaceable.target,
    );
    if (patched === null) {
      return skip(
        "PATCH_PRECONDITION_FAILED",
        "TOML source value is not unique on the evidence line",
      );
    }
    try {
      parse(context.fileText);
      parse(patched);
    } catch {
      return skip("PATCH_PRECONDITION_FAILED", "Patched TOML would be invalid");
    }
    return makePatch(
      context,
      this.id,
      this.version,
      patched,
      replaceable.source,
      replaceable.target,
      "Replace TOML value on the evidence line",
    );
  },
};

function skip(code: string, reason: string): PatchSkip {
  return { skip: true, code, reason };
}
