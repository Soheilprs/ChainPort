import type { ComponentDraft, Detector, RequirementDraft } from "../types.js";
import { boundExcerpt } from "../redaction.js";
import { findLineMatching } from "../parse/text.js";

export const frontendDetector: Detector = {
  id: "frontend",
  version: "1",
  detect(context) {
    const components: ComponentDraft[] = [];
    const requirements: RequirementDraft[] = [];
    const packageJson = context.files.find((file) => file.path === "package.json");
    if (packageJson?.text === undefined) {
      return { requirements, components };
    }
    const next =
      packageJson.text.includes('"next"') &&
      context.files.some((file) => file.path.startsWith("app/") || file.path.startsWith("pages/"));
    if (next) {
      components.push({ kind: "FRONTEND", name: "next", detail: null, filePath: "package.json" });
      const line = findLineMatching(packageJson.text, /"next"/) ?? 1;
      requirements.push({
        category: "FRONTEND",
        key: "NEXTJS",
        requirementType: "FRAMEWORK",
        detectedValue: "next",
        normalizedValue: "next",
        confidence: "DETECTED",
        detector: "frontend",
        detectorVersion: "1",
        evidence: [
          {
            filePath: "package.json",
            startLine: line,
            endLine: line,
            evidenceType: "package.json",
            excerpt: boundExcerpt('"next"'),
          },
        ],
      });
    }
    return { requirements, components };
  },
};
