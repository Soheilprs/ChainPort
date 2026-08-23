import type { Detector, RequirementDraft } from "../types.js";
import { boundExcerpt, looksLikeSecretValue } from "../redaction.js";

const INTERESTING =
  /RPC|CHAIN_ID|USDC|USDT|WETH|\bLINK\b|CHAINLINK|LAYERZERO|PERMIT|SAFE|PRIVATE_KEY|API_KEY|EXPLORER|NETWORK/i;

const NON_NETWORK = /DECIMALS|DATABASE|JWT|SENTRY|EMAIL|NEXTAUTH|PASSWORD|MNEMONIC|TLS|CONTAINER/i;

export const envDetector: Detector = {
  id: "env",
  version: "1",
  detect(context) {
    const requirements: RequirementDraft[] = [];
    for (const file of context.analyzedFiles()) {
      if (file.category !== "ENV_TEMPLATE" || file.text === undefined) {
        continue;
      }
      const redactAll = file.path === ".env" || file.path.endsWith("/.env");
      const lines = file.text.split("\n");
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] ?? "";
        if (!line.includes("=") || line.trim().startsWith("#")) {
          continue;
        }
        const [rawKey, ...rest] = line.split("=");
        const key = rawKey?.trim() ?? "";
        if (!INTERESTING.test(key) || NON_NETWORK.test(key)) {
          continue;
        }
        const rawValue = rest.join("=").trim();
        const value =
          redactAll || looksLikeSecretValue(rawValue) || /key|secret|token|password/i.test(key)
            ? "[REDACTED]"
            : rawValue;
        requirements.push({
          category: "CONFIGURATION",
          key: "ENV_KEY",
          requirementType: "ENVIRONMENT",
          detectedValue: key,
          normalizedValue: value.length > 0 ? `${key}=${value}` : key,
          confidence: "DETECTED",
          detector: "env",
          detectorVersion: "1",
          evidence: [
            {
              filePath: file.path,
              startLine: i + 1,
              endLine: i + 1,
              evidenceType: "env",
              excerpt: boundExcerpt(`${key}=${value}`),
            },
          ],
        });
      }
    }
    return { requirements, components: [] };
  },
};
