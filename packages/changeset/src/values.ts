import type { PatchableAction } from "./types.js";

export interface Replaceable {
  source: string;
  target: string;
  envKey: string | null;
}

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export function parseEnvAssignment(value: string): { key: string; value: string } | null {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(value.trim());
  if (match === null || match[1] === undefined || match[2] === undefined) {
    return null;
  }
  return { key: match[1], value: match[2] };
}

export function extractReplaceable(action: PatchableAction): Replaceable | null {
  if (action.targetValue === null || action.targetValue.trim() === "") {
    return null;
  }
  if (
    action.targetValue.includes("[REDACTED]") ||
    (action.sourceValue ?? "").includes("[REDACTED]")
  ) {
    return null;
  }
  if (action.category === "ENV_CONFIG" && action.sourceValue !== null) {
    const parsed = parseEnvAssignment(action.sourceValue);
    if (parsed !== null) {
      return { source: parsed.value, target: action.targetValue, envKey: parsed.key };
    }
  }
  if (action.sourceValue === null) {
    return null;
  }
  if (action.category === "CHAIN_ID") {
    const source = action.sourceValue.match(/^\d+/)?.[0];
    const target = action.targetValue.match(/^\d+/)?.[0];
    if (source === undefined || target === undefined) {
      return null;
    }
    return { source, target, envKey: null };
  }
  if (action.category === "TOKEN_ADDRESS") {
    const source = action.sourceValue.match(/0x[a-fA-F0-9]{40}/)?.[0];
    const target = action.targetValue.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (source === undefined || target === undefined) {
      return null;
    }
    return { source, target, envKey: null };
  }
  return { source: action.sourceValue, target: action.targetValue, envKey: null };
}

export function isWethAction(action: PatchableAction): boolean {
  return action.semanticKey.includes("WETH") || action.semanticKey.startsWith("token:WETH");
}

export function isAddress(value: string): boolean {
  return ADDRESS.test(value);
}
