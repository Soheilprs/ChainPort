import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import type { DeploymentCandidateConfidence, DeploymentFramework } from "@chainport/shared";

export interface DetectedCandidate {
  framework: DeploymentFramework;
  filePath: string;
  entrypoint: string;
  confidence: DeploymentCandidateConfidence;
  evidence: {
    isScript: boolean;
    hasRun: boolean;
    contractName: string | null;
  };
}

const SCRIPT_CONTRACT = /contract\s+([A-Za-z0-9_]+)\s+is\s+[^{]*\bScript\b/;
const RUN_FN = /function\s+run\s*\(/;

export async function detectDeploymentCandidates(repoRoot: string): Promise<DetectedCandidate[]> {
  const foundry = await detectFoundry(repoRoot);
  const hardhat = await detectHardhat(repoRoot);
  return [...foundry, ...hardhat];
}

async function detectFoundry(repoRoot: string): Promise<DetectedCandidate[]> {
  const scriptDir = path.join(repoRoot, "script");
  if (!(await isDirectory(scriptDir))) {
    return [];
  }
  const files = await listSolidity(scriptDir, "script");
  const candidates: DetectedCandidate[] = [];
  for (const filePath of files) {
    const source = await readFile(path.join(repoRoot, filePath), "utf8");
    const match = SCRIPT_CONTRACT.exec(source);
    const hasRun = RUN_FN.test(source);
    if (match === null && !filePath.endsWith(".s.sol")) {
      continue;
    }
    const contractName = match?.[1] ?? null;
    const confidence: DeploymentCandidateConfidence =
      match !== null && hasRun ? "DETECTED" : "LIKELY";
    candidates.push({
      framework: "FOUNDRY",
      filePath,
      entrypoint: contractName === null ? "run" : `${path.basename(filePath)}:${contractName}`,
      confidence,
      evidence: { isScript: match !== null, hasRun, contractName },
    });
  }
  return candidates;
}

async function detectHardhat(repoRoot: string): Promise<DetectedCandidate[]> {
  const names = [
    "deploy/deploy.ts",
    "deploy/00_deploy.ts",
    "scripts/deploy.ts",
    "scripts/deploy.js",
  ];
  const found: DetectedCandidate[] = [];
  for (const filePath of names) {
    try {
      await stat(path.join(repoRoot, filePath));
    } catch {
      continue;
    }
    found.push({
      framework: "HARDHAT",
      filePath,
      entrypoint: "run",
      confidence: "LIKELY",
      evidence: { isScript: true, hasRun: false, contractName: null },
    });
  }
  return found;
}

async function listSolidity(absDir: string, relative: string): Promise<string[]> {
  const entries = await readdir(absDir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const rel = `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...(await listSolidity(path.join(absDir, entry.name), rel)));
    } else if (entry.name.endsWith(".sol")) {
      out.push(rel);
    }
  }
  return out;
}

async function isDirectory(abs: string): Promise<boolean> {
  try {
    return (await stat(abs)).isDirectory();
  } catch {
    return false;
  }
}

export function assertSafeCandidatePath(filePath: string): string {
  const normalized = filePath.replaceAll("\\", "/").replace(/^\.\//, "");
  if (
    normalized.startsWith("/") ||
    normalized.includes("..") ||
    normalized.includes("\0") ||
    !/^(script|deploy|scripts)\//.test(normalized)
  ) {
    throw new Error("deployment candidate path is not allowed");
  }
  return normalized;
}
