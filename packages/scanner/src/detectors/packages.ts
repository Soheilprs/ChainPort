import type { ComponentDraft, Detector, RequirementDraft } from "../types.js";
import { boundExcerpt } from "../redaction.js";
import { findLineMatching } from "../parse/text.js";

const LIBRARIES = ["viem", "ethers", "wagmi", "hardhat", "forge-std"] as const;

export const packagesDetector: Detector = {
  id: "packages",
  version: "1",
  detect(context) {
    const components: ComponentDraft[] = [];
    const requirements: RequirementDraft[] = [];
    const manifest = context.files.find(
      (file) => file.path === "package.json" && file.text !== undefined,
    );
    if (manifest?.text === undefined) {
      const lock =
        context.files.find((file) => file.path === "pnpm-lock.yaml") ??
        context.files.find((file) => file.path === "yarn.lock") ??
        context.files.find((file) => file.path === "package-lock.json");
      if (lock !== undefined) {
        const name =
          lock.path === "pnpm-lock.yaml" ? "pnpm" : lock.path === "yarn.lock" ? "yarn" : "npm";
        components.push({ kind: "PACKAGE_MANAGER", name, detail: null, filePath: lock.path });
      }
      return { requirements, components };
    }

    let parsed: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    try {
      parsed = JSON.parse(manifest.text) as typeof parsed;
    } catch {
      return { requirements, components };
    }
    const deps = { ...parsed.dependencies, ...parsed.devDependencies };
    for (const library of LIBRARIES) {
      if (deps[library] === undefined) {
        continue;
      }
      const line = findLineMatching(manifest.text, new RegExp(`"${library}"`)) ?? 1;
      components.push({
        kind: library === "hardhat" ? "FRAMEWORK" : "DEPENDENCY",
        name: library,
        detail: deps[library] ?? null,
        filePath: manifest.path,
      });
      if (library === "viem" || library === "ethers" || library === "wagmi") {
        requirements.push({
          category: "FRONTEND",
          key: library.toUpperCase(),
          requirementType: "PACKAGE_DEPENDENCY",
          detectedValue: library,
          normalizedValue: library,
          confidence: "DETECTED",
          detector: "packages",
          detectorVersion: "1",
          evidence: [
            {
              filePath: manifest.path,
              startLine: line,
              endLine: line,
              evidenceType: "package.json",
              excerpt: boundExcerpt(`"${library}": "${deps[library]}"`),
            },
          ],
        });
      }
    }
    if (context.files.some((file) => file.path === "pnpm-lock.yaml")) {
      components.push({
        kind: "PACKAGE_MANAGER",
        name: "pnpm",
        detail: null,
        filePath: "pnpm-lock.yaml",
      });
    } else if (context.files.some((file) => file.path === "yarn.lock")) {
      components.push({
        kind: "PACKAGE_MANAGER",
        name: "yarn",
        detail: null,
        filePath: "yarn.lock",
      });
    } else if (context.files.some((file) => file.path === "package-lock.json")) {
      components.push({
        kind: "PACKAGE_MANAGER",
        name: "npm",
        detail: null,
        filePath: "package-lock.json",
      });
    }
    if (context.files.some((file) => file.path.endsWith(".ts") || file.path.endsWith(".tsx"))) {
      components.push({ kind: "LANGUAGE", name: "typescript", detail: null, filePath: null });
    }
    if (context.files.some((file) => file.path.endsWith(".js") || file.path.endsWith(".jsx"))) {
      components.push({ kind: "LANGUAGE", name: "javascript", detail: null, filePath: null });
    }
    return { requirements, components };
  },
};
