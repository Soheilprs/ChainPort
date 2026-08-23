import type { Detector, RequirementDraft } from "../types.js";
import { parseSoliditySource } from "../parse/solidity.js";
import { boundExcerpt } from "../redaction.js";
import { lineAt } from "../parse/text.js";

interface ProtocolRule {
  key: string;
  category: RequirementDraft["category"];
  importIncludes: readonly string[];
  identifiers: readonly string[];
  packageNames: readonly string[];
}

const RULES: readonly ProtocolRule[] = [
  {
    key: "CHAINLINK",
    category: "ORACLE",
    importIncludes: ["@chainlink/", "AggregatorV3Interface"],
    identifiers: ["AggregatorV3Interface", "latestRoundData"],
    packageNames: ["@chainlink/contracts"],
  },
  {
    key: "CHAINLINK_FUNCTIONS",
    category: "ORACLE",
    importIncludes: ["FunctionsClient", "@chainlink/functions"],
    identifiers: ["FunctionsClient", "FunctionsRequest"],
    packageNames: ["@chainlink/functions-contract"],
  },
  {
    key: "UNISWAP_V3",
    category: "PROTOCOL",
    importIncludes: ["@uniswap/v3-"],
    identifiers: ["IUniswapV3Pool", "ISwapRouter"],
    packageNames: ["@uniswap/v3-core", "@uniswap/v3-periphery"],
  },
  {
    key: "UNISWAP_V2",
    category: "PROTOCOL",
    importIncludes: ["@uniswap/v2-"],
    identifiers: ["IUniswapV2Pair", "IUniswapV2Router"],
    packageNames: ["@uniswap/v2-core", "@uniswap/v2-periphery"],
  },
  {
    key: "LAYERZERO",
    category: "CROSS_CHAIN",
    importIncludes: ["@layerzerolabs/", "ILayerZeroEndpoint"],
    identifiers: ["ILayerZeroEndpoint", "lzReceive"],
    packageNames: ["@layerzerolabs/lz-evm-protocol-v2", "@layerzerolabs/solidity-examples"],
  },
  {
    key: "SAFE",
    category: "PROTOCOL",
    importIncludes: ["safe-contracts", "GnosisSafe"],
    identifiers: ["GnosisSafe", "SafeProxy"],
    packageNames: ["@safe-global/safe-contracts"],
  },
  {
    key: "PERMIT2",
    category: "PROTOCOL",
    importIncludes: ["permit2", "IAllowanceTransfer"],
    identifiers: ["IAllowanceTransfer", "Permit2"],
    packageNames: ["permit2"],
  },
];

export const protocolsDetector: Detector = {
  id: "protocols",
  version: "1",
  detect(context) {
    const requirements: RequirementDraft[] = [];
    const packageJson = context.files.find((file) => file.path === "package.json")?.text ?? "";
    for (const rule of RULES) {
      const evidence: RequirementDraft["evidence"] = [];
      for (const file of context.analyzedFiles()) {
        if (file.category !== "SOLIDITY" || file.text === undefined) {
          continue;
        }
        const facts = parseSoliditySource(file.text);
        for (const imported of facts.imports) {
          if (rule.importIncludes.some((fragment) => imported.path.includes(fragment))) {
            evidence.push({
              filePath: file.path,
              startLine: imported.line,
              endLine: imported.line,
              evidenceType: "import",
              excerpt: boundExcerpt(lineAt(file.text, imported.line)),
            });
          }
        }
        for (const identifier of rule.identifiers) {
          if (file.text.includes(identifier)) {
            const line = file.text.split("\n").findIndex((entry) => entry.includes(identifier)) + 1;
            evidence.push({
              filePath: file.path,
              startLine: line,
              endLine: line,
              evidenceType: "identifier",
              excerpt: boundExcerpt(lineAt(file.text, line)),
            });
          }
        }
      }
      if (rule.packageNames.some((name) => packageJson.includes(`"${name}"`))) {
        evidence.push({
          filePath: "package.json",
          startLine: 1,
          endLine: 1,
          evidenceType: "package.json",
          excerpt: boundExcerpt(rule.packageNames.join(", ")),
        });
      }
      if (evidence.length === 0) {
        continue;
      }
      requirements.push({
        category: rule.category,
        key: rule.key,
        requirementType: "PROTOCOL",
        detectedValue: rule.key,
        normalizedValue: rule.key,
        confidence: "DETECTED",
        detector: "protocols",
        detectorVersion: "1",
        evidence: evidence.slice(0, 8),
      });
    }
    return { requirements, components: [] };
  },
};
