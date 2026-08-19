import type { ComponentDraft, Detector, RequirementDraft } from "../types.js";
import { parseSoliditySource } from "../parse/solidity.js";
import { boundExcerpt } from "../redaction.js";
import { lineAt } from "../parse/text.js";

export const solidityDetector: Detector = {
  id: "solidity",
  version: "1",
  detect(context) {
    const components: ComponentDraft[] = [];
    const requirements: RequirementDraft[] = [];
    const files = context
      .analyzedFiles()
      .filter((file) => file.category === "SOLIDITY" && file.text);
    if (files.length > 0) {
      components.push({
        kind: "LANGUAGE",
        name: "solidity",
        detail: `${files.length} files`,
        filePath: files[0]?.path ?? null,
      });
    }
    for (const file of files) {
      const facts = parseSoliditySource(file.text ?? "");
      if (facts.pragma !== null && facts.pragmaLine !== null) {
        requirements.push({
          category: "CONFIGURATION",
          key: "SOLIDITY_PRAGMA",
          requirementType: "COMPILER",
          detectedValue: facts.pragma,
          normalizedValue: facts.pragma,
          confidence: "DETECTED",
          detector: "solidity",
          detectorVersion: "1",
          evidence: [
            {
              filePath: file.path,
              startLine: facts.pragmaLine,
              endLine: facts.pragmaLine,
              evidenceType: "pragma",
              excerpt: boundExcerpt(lineAt(file.text ?? "", facts.pragmaLine)),
            },
          ],
        });
      }
      for (const definition of facts.definitions) {
        const kind =
          definition.kind === "interface"
            ? "INTERFACE"
            : definition.kind === "library"
              ? "LIBRARY"
              : "CONTRACT";
        components.push({
          kind,
          name: definition.name,
          detail: null,
          filePath: file.path,
        });
      }
      for (const imported of facts.imports) {
        requirements.push({
          category: "CONFIGURATION",
          key: "SOLIDITY_IMPORT",
          requirementType: "SOLIDITY_IMPORT",
          detectedValue: imported.path,
          normalizedValue: imported.path,
          confidence: "DETECTED",
          detector: "solidity",
          detectorVersion: "1",
          evidence: [
            {
              filePath: file.path,
              startLine: imported.line,
              endLine: imported.line,
              evidenceType: "import",
              excerpt: boundExcerpt(lineAt(file.text ?? "", imported.line)),
            },
          ],
        });
      }
    }
    return { requirements, components };
  },
};
