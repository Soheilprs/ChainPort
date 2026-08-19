import { resolveImageTag, type SandboxImageKind } from "@chainport/sandbox";
import { VALIDATION_PROFILE_ID, VALIDATION_PROFILE_VERSION } from "@chainport/shared";

import type { DetectedWorkspace } from "./detect.js";

export const PROFILE_REF = `${VALIDATION_PROFILE_ID}@${VALIDATION_PROFILE_VERSION}`;

export interface ProfileCommand {
  argv: readonly string[];
  network: "none" | "install";
  step: "INSTALL" | "BUILD" | "TEST";
}

export interface SelectedProfile {
  id: typeof VALIDATION_PROFILE_ID;
  version: typeof VALIDATION_PROFILE_VERSION;
  imageKind: SandboxImageKind;
  commands: readonly ProfileCommand[];
  skipInstall: boolean;
  unsupportedCode: string | null;
  unsupportedReason: string | null;
}

const SUPPORTED_NODE = new Set([20, 22]);

export function selectProfile(
  detected: DetectedWorkspace,
  imageOverrides: { foundry?: string; node20?: string; node22?: string } = {},
): SelectedProfile {
  void imageOverrides;
  if (detected.dockerRequired) {
    return unsupported(
      "UNSUPPORTED_TEST_REQUIREMENT",
      "Repository tests appear to require Docker Compose",
    );
  }
  if (detected.framework === "FOUNDRY") {
    const commands: ProfileCommand[] = [];
    if (detected.hasGitmodules) {
      commands.push({
        step: "INSTALL",
        network: "install",
        argv: ["git", "submodule", "update", "--init", "--recursive"],
      });
    }
    commands.push({ step: "BUILD", network: "none", argv: ["forge", "build"] });
    commands.push({ step: "TEST", network: "none", argv: ["forge", "test"] });
    return {
      id: VALIDATION_PROFILE_ID,
      version: VALIDATION_PROFILE_VERSION,
      imageKind: "foundry",
      commands,
      skipInstall: !detected.hasGitmodules,
      unsupportedCode: null,
      unsupportedReason: null,
    };
  }
  if (detected.framework === "HARDHAT") {
    if (detected.nodeMajor !== null && !SUPPORTED_NODE.has(detected.nodeMajor)) {
      return unsupported(
        "UNSUPPORTED_RUNTIME_VERSION",
        `Node ${detected.nodeMajor} is not in the approved sandbox matrix (20, 22)`,
      );
    }
    if (!detected.hasLockfile || detected.packageManager === null) {
      return unsupported(
        "DEPENDENCY_RESOLUTION_FAILED",
        "Hardhat validation requires a committed lockfile",
      );
    }
    const install = installCommand(detected.packageManager);
    return {
      id: VALIDATION_PROFILE_ID,
      version: VALIDATION_PROFILE_VERSION,
      imageKind: detected.nodeMajor === 20 ? "node20" : "node22",
      commands: [
        { step: "INSTALL", network: "install", argv: install },
        {
          step: "BUILD",
          network: "none",
          argv: ["node", "node_modules/hardhat/internal/cli/cli.js", "compile"],
        },
        {
          step: "TEST",
          network: "none",
          argv: ["node", "node_modules/hardhat/internal/cli/cli.js", "test"],
        },
      ],
      skipInstall: false,
      unsupportedCode: null,
      unsupportedReason: null,
    };
  }
  return unsupported("UNSUPPORTED_FRAMEWORK", detected.reason ?? "No supported framework");
}

export function imageForProfile(
  selected: SelectedProfile,
  overrides: { foundry?: string; node20?: string; node22?: string } = {},
): string {
  return resolveImageTag(selected.imageKind, overrides);
}

function installCommand(manager: "pnpm" | "npm" | "yarn"): string[] {
  if (manager === "pnpm") {
    return ["pnpm", "install", "--frozen-lockfile", "--ignore-scripts"];
  }
  if (manager === "yarn") {
    return ["yarn", "install", "--immutable", "--ignore-scripts"];
  }
  return ["npm", "ci", "--ignore-scripts"];
}

function unsupported(code: string, reason: string): SelectedProfile {
  return {
    id: VALIDATION_PROFILE_ID,
    version: VALIDATION_PROFILE_VERSION,
    imageKind: "foundry",
    commands: [],
    skipInstall: true,
    unsupportedCode: code,
    unsupportedReason: reason,
  };
}
