import { getChainByChainId, listChains } from "@chainport/chain-registry";
import { parse } from "smol-toml";

import type { Detector, RequirementDraft } from "../types.js";
import { parseTypeScriptSource } from "../parse/typescript-source.js";
import { boundExcerpt } from "../redaction.js";
import { findLineMatching, lineAt } from "../parse/text.js";

const knownIds = new Set(listChains().map((chain) => chain.chainId));

function requirement(
  filePath: string,
  line: number,
  text: string,
  chainId: number,
): RequirementDraft | undefined {
  if (!knownIds.has(chainId)) {
    return undefined;
  }
  const chain = getChainByChainId(chainId);
  return {
    category: "NETWORK",
    key: "HARDCODED_CHAIN_ID",
    requirementType: "CHAIN_ID",
    detectedValue: String(chainId),
    normalizedValue: chain?.key ?? String(chainId),
    confidence: "DETECTED",
    detector: "chain-id",
    detectorVersion: "1",
    evidence: [
      {
        filePath,
        startLine: line,
        endLine: line,
        evidenceType: "chainId",
        excerpt: boundExcerpt(text),
      },
    ],
  };
}

function isConfigPath(path: string): boolean {
  const base = path.split("/").at(-1) ?? "";
  return (
    base.startsWith("hardhat.config") ||
    base === "foundry.toml" ||
    base.includes("wagmi") ||
    base.includes("viem") ||
    path.includes("config")
  );
}

export const chainIdDetector: Detector = {
  id: "chain-id",
  version: "1",
  detect(context) {
    const requirements: RequirementDraft[] = [];
    for (const file of context.analyzedFiles()) {
      if (
        file.category === "MARKDOWN" ||
        file.path.includes("/test/") ||
        file.path.includes("/tests/")
      ) {
        continue;
      }
      if (file.text === undefined) {
        continue;
      }
      if (file.category === "TOML" && file.path.endsWith("foundry.toml")) {
        try {
          const parsed = parse(file.text) as Record<string, unknown>;
          const profile = parsed.profile;
          if (typeof profile === "object" && profile !== null) {
            const defaultProfile = (profile as Record<string, unknown>).default;
            if (typeof defaultProfile === "object" && defaultProfile !== null) {
              const chainId = (defaultProfile as Record<string, unknown>).chain_id;
              if (typeof chainId === "number") {
                const line = findLineMatching(file.text, /chain_id/) ?? 1;
                const draft = requirement(file.path, line, lineAt(file.text, line), chainId);
                if (draft) {
                  requirements.push(draft);
                }
              }
            }
          }
        } catch {
          // ignore invalid toml
        }
      }
      if (
        (file.category === "TYPESCRIPT" || file.category === "JAVASCRIPT") &&
        isConfigPath(file.path)
      ) {
        try {
          const ast = parseTypeScriptSource(file.path, file.text);
          for (const property of ast.numericProperties) {
            if (
              property.name === "chainId" ||
              property.name === "id" ||
              property.name === "chain_id"
            ) {
              if (property.name === "id" && !knownIds.has(property.value)) {
                continue;
              }
              const draft = requirement(
                file.path,
                property.line,
                lineAt(file.text, property.line),
                property.value,
              );
              if (draft) {
                requirements.push(draft);
              }
            }
          }
        } catch {
          // ignore unparseable source
        }
      }
      if (file.category === "JSON") {
        const chainIdMatches = [...file.text.matchAll(/"chainId"\s*:\s*(\d+)/g)];
        for (const match of chainIdMatches) {
          const value = Number(match[1]);
          const line = findLineMatching(file.text, /"chainId"/) ?? 1;
          const draft = requirement(file.path, line, lineAt(file.text, line), value);
          if (draft) {
            requirements.push(draft);
          }
        }
      }
    }
    return { requirements, components: [] };
  },
};
