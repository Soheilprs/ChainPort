import { checksumAddress, extractAddresses } from "@chainport/evm";

import type { Detector, RequirementDraft } from "../types.js";
import { classifyKnownAddress } from "../catalog/known-addresses.js";
import { boundExcerpt } from "../redaction.js";
import { findLineMatching, lineAt } from "../parse/text.js";

const SKIP = /(?:^|\/)(?:README|CHANGELOG|LICENSE).*|\.md$/i;

export const addressesDetector: Detector = {
  id: "addresses",
  version: "1",
  detect(context) {
    const requirements: RequirementDraft[] = [];
    const seen = new Map<string, RequirementDraft>();
    for (const file of context.analyzedFiles()) {
      if (file.text === undefined || SKIP.test(file.path) || file.category === "MARKDOWN") {
        continue;
      }
      for (const address of extractAddresses(file.text)) {
        const checksummed = checksumAddress(address);
        const known = classifyKnownAddress(checksummed);
        const key = known?.key ?? "UNKNOWN_EVM_ADDRESS";
        const line = findLineMatching(file.text, new RegExp(address, "i")) ?? 1;
        const evidence = {
          filePath: file.path,
          startLine: line,
          endLine: line,
          evidenceType: "address",
          excerpt: boundExcerpt(lineAt(file.text, line)),
        };
        const existing = seen.get(`${key}:${checksummed}`);
        if (existing !== undefined) {
          existing.evidence.push(evidence);
          continue;
        }
        const draft: RequirementDraft = {
          category: known?.category === "TOKEN" ? "TOKEN" : known ? "PROTOCOL" : "CONFIGURATION",
          key,
          requirementType: known ? "NAMED_ADDRESS" : "UNKNOWN_EVM_ADDRESS",
          detectedValue: checksummed,
          normalizedValue: known ? known.key : checksummed,
          confidence: known ? "DETECTED" : "UNKNOWN",
          detector: "addresses",
          detectorVersion: "1",
          evidence: [evidence],
        };
        seen.set(`${key}:${checksummed}`, draft);
        requirements.push(draft);
      }
    }
    return { requirements, components: [] };
  },
};
