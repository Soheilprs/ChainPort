import { envTemplatePatcher } from "./patchers/env-template.js";
import { javaScriptConfigPatcher, typeScriptConfigPatcher } from "./patchers/typescript.js";
import { jsonConfigPatcher } from "./patchers/json.js";
import { solidityAddressPatcher } from "./patchers/solidity-address.js";
import { tomlConfigPatcher } from "./patchers/toml.js";
import { isUnsafeEnvFile, looksBinary } from "./paths.js";
import { isSkip, type GeneratedPatch, type PatchableAction, type PatchSkip } from "./types.js";
import { isWethAction } from "./values.js";

export const SAFE_PATCHERS = [
  envTemplatePatcher,
  jsonConfigPatcher,
  tomlConfigPatcher,
  typeScriptConfigPatcher,
  javaScriptConfigPatcher,
  solidityAddressPatcher,
] as const;

const PATCHABLE_CATEGORIES = new Set([
  "CHAIN_ID",
  "RPC_URL",
  "EXPLORER",
  "ENV_CONFIG",
  "TOKEN_ADDRESS",
  "FRONTEND_NETWORK",
]);

export function generatePatch(input: {
  action: PatchableAction;
  filePath: string;
  fileText: string;
}): GeneratedPatch | PatchSkip {
  if (input.action.automationLevel !== "SAFE_AUTOMATIC") {
    return {
      skip: true,
      code: "CHANGESET_NOT_ELIGIBLE",
      reason: "Only SAFE_AUTOMATIC actions may be patched",
    };
  }
  if (isWethAction(input.action)) {
    return {
      skip: true,
      code: "PATCHER_UNSUPPORTED",
      reason: "WETH is not auto-patched in engine version 1",
    };
  }
  if (!PATCHABLE_CATEGORIES.has(input.action.category)) {
    return {
      skip: true,
      code: "PATCHER_UNSUPPORTED",
      reason: `Category ${input.action.category} is not auto-patched`,
    };
  }
  if (isUnsafeEnvFile(input.filePath)) {
    return {
      skip: true,
      code: "UNSAFE_ENV_FILE",
      reason: "Secret-bearing env files are not auto-patched",
    };
  }
  if (looksBinary(input.fileText)) {
    return { skip: true, code: "PATCHER_UNSUPPORTED", reason: "Binary files are not patched" };
  }
  const evidence = input.action.evidence.filter((item) => item.filePath === input.filePath);
  const context = {
    action: input.action,
    filePath: input.filePath,
    fileText: input.fileText,
    evidence: evidence.length > 0 ? evidence : input.action.evidence,
  };
  const patcher = SAFE_PATCHERS.find((item) => item.supports(context));
  if (patcher === undefined) {
    return {
      skip: true,
      code: "PATCHER_UNSUPPORTED",
      reason: "No safe patcher supports this file",
    };
  }
  const result = patcher.generate(context);
  if (!isSkip(result) && result.patchedText === input.fileText) {
    return { skip: true, code: "SOURCE_MISMATCH", reason: "Patcher produced no content change" };
  }
  return result;
}
