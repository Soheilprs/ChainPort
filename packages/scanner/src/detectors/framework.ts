import { parse } from "smol-toml";

import type { ComponentDraft, Detector, DetectorContext, RequirementDraft } from "../types.js";
import { boundExcerpt } from "../redaction.js";

function file(context: DetectorContext, path: string) {
  return context.files.find((entry) => entry.path === path || entry.path.endsWith(`/${path}`));
}

export const frameworkDetector: Detector = {
  id: "framework",
  version: "1",
  detect(context: DetectorContext) {
    const components: ComponentDraft[] = [];
    const requirements: RequirementDraft[] = [];
    const foundryToml = file(context, "foundry.toml");
    const hasSrc = context.files.some(
      (entry) => entry.path.startsWith("src/") && entry.path.endsWith(".sol"),
    );
    if (foundryToml?.analyzed === true && foundryToml.text !== undefined) {
      try {
        parse(foundryToml.text);
      } catch {
        // still evidence if the file exists and is named foundry.toml
      }
      if (hasSrc) {
        components.push({
          kind: "FRAMEWORK",
          name: "foundry",
          detail: null,
          filePath: foundryToml.path,
        });
        requirements.push({
          category: "FRAMEWORK",
          key: "FOUNDRY",
          requirementType: "FRAMEWORK",
          detectedValue: "foundry",
          normalizedValue: "foundry",
          confidence: "DETECTED",
          detector: "framework",
          detectorVersion: "1",
          evidence: [
            {
              filePath: foundryToml.path,
              startLine: 1,
              endLine: 1,
              evidenceType: "config",
              excerpt: boundExcerpt(foundryToml.text.split("\n")[0] ?? "foundry.toml"),
            },
          ],
        });
      }
    }

    const hardhatConfig = context.files.find((entry) =>
      /^hardhat\.config\.(ts|js|cjs|mjs)$/.test(entry.path.split("/").at(-1) ?? ""),
    );
    const packageJson = file(context, "package.json");
    const mentionsHardhat =
      packageJson?.text !== undefined && packageJson.text.includes('"hardhat"');
    if (hardhatConfig !== undefined && mentionsHardhat) {
      components.push({
        kind: "FRAMEWORK",
        name: "hardhat",
        detail: null,
        filePath: hardhatConfig.path,
      });
      requirements.push({
        category: "FRAMEWORK",
        key: "HARDHAT",
        requirementType: "FRAMEWORK",
        detectedValue: "hardhat",
        normalizedValue: "hardhat",
        confidence: "DETECTED",
        detector: "framework",
        detectorVersion: "1",
        evidence: [
          {
            filePath: hardhatConfig.path,
            startLine: 1,
            endLine: 1,
            evidenceType: "config",
            excerpt: boundExcerpt("hardhat.config"),
          },
        ],
      });
    }
    return { requirements, components };
  },
};
