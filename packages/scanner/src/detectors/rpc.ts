import type { Detector, RequirementDraft } from "../types.js";
import { parseTypeScriptSource } from "../parse/typescript-source.js";
import { boundExcerpt, redactSecretUrl } from "../redaction.js";
import { lineAt } from "../parse/text.js";

const RPC_METHODS = [
  "eth_call",
  "eth_getLogs",
  "eth_estimateGas",
  "eth_getCode",
  "eth_getStorageAt",
  "eth_feeHistory",
  "debug_traceCall",
  "debug_traceTransaction",
] as const;

const VIEM_TO_RPC: Record<string, (typeof RPC_METHODS)[number]> = {
  getLogs: "eth_getLogs",
  estimateGas: "eth_estimateGas",
  getCode: "eth_getCode",
  getStorageAt: "eth_getStorageAt",
  getFeeHistory: "eth_feeHistory",
};

function isNoisePath(path: string): boolean {
  return (
    path.endsWith(".md") ||
    path.includes("/test/") ||
    path.includes("/tests/") ||
    path.includes(".test.") ||
    path.includes(".spec.")
  );
}

export const rpcDetector: Detector = {
  id: "rpc",
  version: "1",
  detect(context) {
    const requirements: RequirementDraft[] = [];
    const seenMethods = new Set<string>();
    for (const file of context.analyzedFiles()) {
      if (file.text === undefined || isNoisePath(file.path)) {
        continue;
      }
      if (
        file.category === "TYPESCRIPT" ||
        file.category === "JAVASCRIPT" ||
        file.category === "JSON"
      ) {
        try {
          if (file.category !== "JSON") {
            const ast = parseTypeScriptSource(file.path, file.text);
            const usesViem = ast.imports.some(
              (entry) => entry.module === "viem" || entry.module.startsWith("viem/"),
            );
            for (const literal of ast.stringLiterals) {
              if ((RPC_METHODS as readonly string[]).includes(literal.value)) {
                addMethod(
                  requirements,
                  seenMethods,
                  literal.value,
                  file.path,
                  literal.line,
                  file.text,
                );
              }
              if (
                /^https?:\/\//.test(literal.value) &&
                /rpc|alchemy|infura|base\.org|llamarpc|ankr/i.test(literal.value)
              ) {
                addRpcUrl(requirements, file.path, literal.line, literal.value);
              }
            }
            if (usesViem) {
              for (const identifier of ast.identifiers) {
                const mapped = VIEM_TO_RPC[identifier];
                if (mapped !== undefined) {
                  const line =
                    file.text.split("\n").findIndex((entry) => entry.includes(identifier)) + 1;
                  addMethod(requirements, seenMethods, mapped, file.path, line, file.text);
                }
              }
            }
          }
        } catch {
          // ignore
        }
        for (const method of RPC_METHODS) {
          if (file.text.includes(`"${method}"`) || file.text.includes(`'${method}'`)) {
            const line = file.text.split("\n").findIndex((entry) => entry.includes(method)) + 1;
            addMethod(requirements, seenMethods, method, file.path, line, file.text);
          }
        }
      }
    }
    return { requirements, components: [] };
  },
};

function addMethod(
  requirements: RequirementDraft[],
  seen: Set<string>,
  method: string,
  filePath: string,
  line: number,
  text: string,
): void {
  if (seen.has(method)) {
    return;
  }
  seen.add(method);
  requirements.push({
    category: "RPC",
    key: "RPC_METHOD",
    requirementType: "JSON_RPC",
    detectedValue: method,
    normalizedValue: method,
    confidence: "DETECTED",
    detector: "rpc",
    detectorVersion: "1",
    evidence: [
      {
        filePath,
        startLine: line,
        endLine: line,
        evidenceType: "rpc_method",
        excerpt: boundExcerpt(lineAt(text, line)),
      },
    ],
  });
}

function addRpcUrl(
  requirements: RequirementDraft[],
  filePath: string,
  line: number,
  url: string,
): void {
  requirements.push({
    category: "RPC",
    key: "RPC_URL",
    requirementType: "ENDPOINT",
    detectedValue: redactSecretUrl(url),
    normalizedValue: redactSecretUrl(url),
    confidence: "DETECTED",
    detector: "rpc",
    detectorVersion: "1",
    evidence: [
      {
        filePath,
        startLine: line,
        endLine: line,
        evidenceType: "rpc_url",
        excerpt: boundExcerpt(redactSecretUrl(url)),
      },
    ],
  });
}
