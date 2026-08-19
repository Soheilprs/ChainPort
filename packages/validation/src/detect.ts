import { access, readFile } from "node:fs/promises";
import path from "node:path";

import type { ValidationFramework } from "@chainport/shared";

const LIFECYCLE_SCRIPTS = new Set([
  "preinstall",
  "install",
  "postinstall",
  "prepublish",
  "prepare",
]);

export interface DetectedWorkspace {
  framework: ValidationFramework | null;
  packageManager: "pnpm" | "npm" | "yarn" | null;
  nodeMajor: number | null;
  hasLockfile: boolean;
  hasLifecycleScripts: boolean;
  hasFoundryToml: boolean;
  hasLib: boolean;
  hasGitmodules: boolean;
  dockerRequired: boolean;
  reason: string | null;
}

export async function detectWorkspace(root: string): Promise<DetectedWorkspace> {
  const hasFoundryToml = await exists(path.join(root, "foundry.toml"));
  const hardhat =
    (await exists(path.join(root, "hardhat.config.ts"))) ||
    (await exists(path.join(root, "hardhat.config.js"))) ||
    (await exists(path.join(root, "hardhat.config.cjs")));
  const hasLib = await exists(path.join(root, "lib"));
  const hasGitmodules = await exists(path.join(root, ".gitmodules"));
  const pkg = await readJson(path.join(root, "package.json"));
  const pnpmLock = await exists(path.join(root, "pnpm-lock.yaml"));
  const npmLock = await exists(path.join(root, "package-lock.json"));
  const yarnLock = await exists(path.join(root, "yarn.lock"));
  const dockerRequired =
    (await exists(path.join(root, "docker-compose.yml"))) && !hasFoundryToml && !hardhat;
  const nodeMajor = await detectNodeMajor(root, pkg);
  const lifecycle = packageLifecycleScripts(pkg);
  let packageManager: DetectedWorkspace["packageManager"] = null;
  if (pnpmLock) packageManager = "pnpm";
  else if (npmLock) packageManager = "npm";
  else if (yarnLock) packageManager = "yarn";

  if (hasFoundryToml) {
    return {
      framework: "FOUNDRY",
      packageManager,
      nodeMajor,
      hasLockfile: pnpmLock || npmLock || yarnLock,
      hasLifecycleScripts: lifecycle,
      hasFoundryToml,
      hasLib,
      hasGitmodules,
      dockerRequired: false,
      reason: null,
    };
  }
  if (hardhat) {
    return {
      framework: "HARDHAT",
      packageManager,
      nodeMajor,
      hasLockfile: pnpmLock || npmLock || yarnLock,
      hasLifecycleScripts: lifecycle,
      hasFoundryToml,
      hasLib,
      hasGitmodules,
      dockerRequired,
      reason: null,
    };
  }
  return {
    framework: null,
    packageManager,
    nodeMajor,
    hasLockfile: pnpmLock || npmLock || yarnLock,
    hasLifecycleScripts: lifecycle,
    hasFoundryToml,
    hasLib,
    hasGitmodules,
    dockerRequired,
    reason: "No foundry.toml or hardhat.config.* was found",
  };
}

function packageLifecycleScripts(pkg: Record<string, unknown> | null): boolean {
  if (pkg === null || !isRecord(pkg.scripts)) {
    return false;
  }
  return Object.keys(pkg.scripts).some((key) => LIFECYCLE_SCRIPTS.has(key));
}

async function detectNodeMajor(
  root: string,
  pkg: Record<string, unknown> | null,
): Promise<number | null> {
  const nvm = await readOptional(path.join(root, ".nvmrc"));
  const nodeVersion = await readOptional(path.join(root, ".node-version"));
  const fromFile = parseMajor(nvm ?? nodeVersion);
  if (fromFile !== null) {
    return fromFile;
  }
  if (pkg !== null && isRecord(pkg.engines) && typeof pkg.engines.node === "string") {
    return parseMajor(pkg.engines.node);
  }
  return null;
}

function parseMajor(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const match = /(\d{1,2})/.exec(value.trim());
  if (match === null || match[1] === undefined) {
    return null;
  }
  return Number(match[1]);
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function readOptional(target: string): Promise<string | null> {
  try {
    return await readFile(target, "utf8");
  } catch {
    return null;
  }
}

async function readJson(target: string): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(target, "utf8"));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
