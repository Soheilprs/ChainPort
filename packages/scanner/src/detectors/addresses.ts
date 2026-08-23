import { checksumAddress, extractAddresses } from "@chainport/evm";

import type { Detector, RequirementDraft } from "../types.js";
import { classifyAddressContext } from "../catalog/address-semantics.js";
import { boundExcerpt } from "../redaction.js";
import { parseSoliditySource } from "../parse/solidity.js";
import { findLineMatching, lineAt } from "../parse/text.js";
import { parseTypeScriptSource } from "../parse/typescript-source.js";

function isNoisePath(path: string): boolean {
  const lower = path.toLowerCase();
  const segments = lower.split("/");
  return (
    lower.endsWith(".md") ||
    /(?:^|\/)(?:readme|changelog|license)/i.test(path) ||
    segments.includes("test") ||
    segments.includes("tests") ||
    segments.includes("mocks") ||
    lower.includes(".test.") ||
    lower.includes(".spec.") ||
    lower.endsWith(".t.sol") ||
    segments.includes(".openzeppelin") ||
    segments.includes("broadcast") ||
    segments.includes("deployments")
  );
}

export const addressesDetector: Detector = {
  id: "addresses",
  version: "2",
  detect(context) {
    const requirements: RequirementDraft[] = [];
    const seen = new Map<string, RequirementDraft>();
    const contractNames = [
      ...new Set(
        context
          .analyzedFiles()
          .filter((file) => file.category === "SOLIDITY" && file.text !== undefined)
          .flatMap((file) =>
            parseSoliditySource(file.text ?? "").definitions.map((item) => item.name),
          ),
      ),
    ];

    for (const file of context.analyzedFiles()) {
      if (
        file.text === undefined ||
        file.category === "MARKDOWN" ||
        file.category === "ENV_TEMPLATE" ||
        isNoisePath(file.path)
      ) {
        continue;
      }
      const namesByAddress = namesForFile(file.path, file.text);
      for (const address of extractAddresses(file.text)) {
        const checksummed = checksumAddress(address);
        const semantic = classifyAddressContext({
          address: checksummed,
          names: namesByAddress.get(checksummed.toLowerCase()) ?? [],
          contractNames,
        });
        const line = findLineMatching(file.text, new RegExp(address, "i")) ?? 1;
        const evidence = {
          filePath: file.path,
          startLine: line,
          endLine: line,
          evidenceType: "address",
          excerpt: boundExcerpt(lineAt(file.text, line)),
        };
        const draft = toDraft(semantic, checksummed, evidence);
        const mergeKey =
          semantic.kind === "project"
            ? `PROJECT_DEPLOYMENT:${semantic.name}`
            : semantic.kind === "named"
              ? `${semantic.key}:${checksummed}`
              : `UNKNOWN_EVM_ADDRESS:${checksummed}`;
        const existing = seen.get(mergeKey);
        if (existing !== undefined) {
          existing.evidence.push(evidence);
          continue;
        }
        seen.set(mergeKey, draft);
        requirements.push(draft);
      }
    }
    return { requirements, components: [] };
  },
};

function namesForFile(path: string, text: string): Map<string, string[]> {
  const names = new Map<string, string[]>();
  const add = (address: string, extra: readonly string[]) => {
    const key = address.toLowerCase();
    const current = names.get(key) ?? [];
    names.set(key, [...current, ...extra]);
  };
  if (
    path.endsWith(".ts") ||
    path.endsWith(".tsx") ||
    path.endsWith(".js") ||
    path.endsWith(".jsx") ||
    path.endsWith(".mjs") ||
    path.endsWith(".cjs")
  ) {
    try {
      for (const binding of parseTypeScriptSource(path, text).addressBindings) {
        add(binding.address, binding.names);
      }
    } catch {
      // fall through to line-level identifiers
    }
  }
  if (path.endsWith(".sol")) {
    for (const entry of parseSoliditySource(text).addressConstants) {
      add(entry.address, [entry.name]);
    }
  }
  return names;
}

function toDraft(
  semantic: ReturnType<typeof classifyAddressContext>,
  checksummed: string,
  evidence: RequirementDraft["evidence"][number],
): RequirementDraft {
  if (semantic.kind === "named") {
    return {
      category: semantic.category,
      key: semantic.key,
      requirementType: semantic.requirementType,
      detectedValue: checksummed,
      normalizedValue: semantic.key,
      confidence: "DETECTED",
      detector: "addresses",
      detectorVersion: "2",
      evidence: [evidence],
    };
  }
  if (semantic.kind === "project") {
    return {
      category: "CONFIGURATION",
      key: "PROJECT_DEPLOYMENT",
      requirementType: "PROJECT_DEPLOYMENT",
      detectedValue: checksummed,
      normalizedValue: semantic.name,
      confidence: "DETECTED",
      detector: "addresses",
      detectorVersion: "2",
      evidence: [evidence],
    };
  }
  return {
    category: "CONFIGURATION",
    key: "UNKNOWN_EVM_ADDRESS",
    requirementType: "UNKNOWN_EVM_ADDRESS",
    detectedValue: checksummed,
    normalizedValue: checksummed,
    confidence: "UNKNOWN",
    detector: "addresses",
    detectorVersion: "2",
    evidence: [evidence],
  };
}
