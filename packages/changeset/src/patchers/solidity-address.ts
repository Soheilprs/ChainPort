import { makePatch, replaceLineValue } from "../patch.js";
import type { PatchSkip, SafePatcher } from "../types.js";
import { extractReplaceable, isAddress } from "../values.js";

export const solidityAddressPatcher: SafePatcher = {
  id: "solidity-address",
  version: "1",
  supports(context) {
    return context.filePath.endsWith(".sol") && context.action.category === "TOKEN_ADDRESS";
  },
  generate(context) {
    const replaceable = extractReplaceable(context.action);
    if (replaceable === null || !isAddress(replaceable.source) || !isAddress(replaceable.target)) {
      return skip("PATCH_PRECONDITION_FAILED", "Solidity patches require verified addresses");
    }
    const line = context.evidence[0]?.startLine;
    if (line === undefined) {
      return skip("PATCHER_UNSUPPORTED", "Solidity address patches require an evidence line");
    }
    const patched = replaceLineValue(
      context.fileText,
      line,
      replaceable.source,
      replaceable.target,
    );
    if (patched === null) {
      const insensitive = replaceLineInsensitive(
        context.fileText,
        line,
        replaceable.source,
        replaceable.target,
      );
      if (insensitive === null) {
        return skip(
          "SOURCE_MISMATCH",
          "Evidence line does not contain the source address uniquely",
        );
      }
      return makePatch(
        context,
        this.id,
        this.version,
        insensitive,
        replaceable.source,
        replaceable.target,
        "Replace token address on the evidence line",
      );
    }
    return makePatch(
      context,
      this.id,
      this.version,
      patched,
      replaceable.source,
      replaceable.target,
      "Replace token address on the evidence line",
    );
  },
};

function replaceLineInsensitive(
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
  const regex = new RegExp(source, "i");
  const matches = line.match(new RegExp(source, "gi")) ?? [];
  if (matches.length !== 1) {
    return null;
  }
  lines[index] = line.replace(regex, target);
  return lines.join("\n");
}

function skip(code: string, reason: string): PatchSkip {
  return { skip: true, code, reason };
}
