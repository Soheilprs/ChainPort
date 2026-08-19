import { describe, expect, it } from "vitest";

import { applyPatchToWorkingText, generatePatch } from "../src/index.js";
import type { PatchableAction } from "../src/types.js";

function action(
  partial: Partial<PatchableAction> &
    Pick<PatchableAction, "category" | "sourceValue" | "targetValue">,
): PatchableAction {
  return {
    id: "action-1",
    semanticKey: partial.semanticKey ?? partial.category,
    automationLevel: partial.automationLevel ?? "SAFE_AUTOMATIC",
    evidence: partial.evidence ?? [
      { filePath: "file", startLine: 1, excerpt: partial.sourceValue ?? "" },
    ],
    ...partial,
  };
}

describe("safe patchers", () => {
  it("A: patches env template chain id and RPC surgically", () => {
    const text = "CHAIN_ID=8453\nRPC_URL=https://mainnet.base.org\nOTHER=keep\n";
    const chain = generatePatch({
      action: action({
        category: "ENV_CONFIG",
        sourceValue: "CHAIN_ID=8453",
        targetValue: "10",
        evidence: [{ filePath: ".env.example", startLine: 1, excerpt: "CHAIN_ID=8453" }],
      }),
      filePath: ".env.example",
      fileText: text,
    });
    const rpc = generatePatch({
      action: action({
        category: "ENV_CONFIG",
        sourceValue: "RPC_URL=https://mainnet.base.org",
        targetValue: "https://mainnet.optimism.io",
        evidence: [
          { filePath: ".env.example", startLine: 2, excerpt: "RPC_URL=https://mainnet.base.org" },
        ],
      }),
      filePath: ".env.example",
      fileText: "skip" in chain ? text : chain.patchedText,
    });
    expect("patchedText" in chain && chain.patchedText).toContain("CHAIN_ID=10");
    expect("patchedText" in rpc && rpc.patchedText).toContain(
      "RPC_URL=https://mainnet.optimism.io",
    );
    expect("patchedText" in rpc && rpc.patchedText).toContain("OTHER=keep");
  });

  it("refuses secret env files", () => {
    const result = generatePatch({
      action: action({
        category: "ENV_CONFIG",
        sourceValue: "CHAIN_ID=8453",
        targetValue: "10",
        evidence: [{ filePath: ".env", startLine: 1, excerpt: "CHAIN_ID=8453" }],
      }),
      filePath: ".env",
      fileText: "CHAIN_ID=8453\n",
    });
    expect(result).toMatchObject({ skip: true, code: "UNSAFE_ENV_FILE" });
  });

  it("B: patches Hardhat chainId without executing the file", () => {
    const text = `export default {\n  networks: {\n    base: { chainId: 8453, url: process.env.RPC_URL }\n  }\n};\n`;
    const result = generatePatch({
      action: action({
        category: "CHAIN_ID",
        sourceValue: "8453",
        targetValue: "10",
        evidence: [{ filePath: "hardhat.config.ts", startLine: 3, excerpt: "chainId: 8453" }],
      }),
      filePath: "hardhat.config.ts",
      fileText: text,
    });
    expect("patchedText" in result && result.patchedText).toContain("chainId: 10");
    expect("patchedText" in result && result.patchedText).toContain("process.env.RPC_URL");
    expect("unifiedDiff" in result && result.unifiedDiff.split("\n").length).toBeLessThan(16);
  });

  it("F: does not rewrite Number(process.env.CHAIN_ID)", () => {
    const result = generatePatch({
      action: action({
        category: "CHAIN_ID",
        sourceValue: "8453",
        targetValue: "10",
        evidence: [
          {
            filePath: "hardhat.config.ts",
            startLine: 2,
            excerpt: "chainId: Number(process.env.CHAIN_ID)",
          },
        ],
      }),
      filePath: "hardhat.config.ts",
      fileText: "export default { chainId: Number(process.env.CHAIN_ID) };\n",
    });
    expect(result).toMatchObject({ skip: true });
  });

  it("C: patches foundry.toml on the evidence line only", () => {
    const text = `[profile.default]\nsrc = "src"\neth_rpc_url = "https://mainnet.base.org"\n`;
    const result = generatePatch({
      action: action({
        category: "RPC_URL",
        sourceValue: "https://mainnet.base.org",
        targetValue: "https://mainnet.optimism.io",
        evidence: [
          {
            filePath: "foundry.toml",
            startLine: 3,
            excerpt: 'eth_rpc_url = "https://mainnet.base.org"',
          },
        ],
      }),
      filePath: "foundry.toml",
      fileText: text,
    });
    expect("patchedText" in result && result.patchedText).toContain("https://mainnet.optimism.io");
    expect("patchedText" in result && result.patchedText).toContain('src = "src"');
  });

  it("D: patches defineChain id/rpc literals", () => {
    const text = `export const chain = defineChain({\n  id: 8453,\n  rpcUrls: { default: { http: ["https://mainnet.base.org"] } }\n});\n`;
    const result = generatePatch({
      action: action({
        category: "CHAIN_ID",
        sourceValue: "8453",
        targetValue: "10",
        evidence: [{ filePath: "src/chains.ts", startLine: 2, excerpt: "id: 8453" }],
      }),
      filePath: "src/chains.ts",
      fileText: text,
    });
    expect("patchedText" in result && result.patchedText).toContain("id: 10");
    expect("patchedText" in result && result.patchedText).toContain("https://mainnet.base.org");
  });

  it("E: does not replace values in comments when the structured node is unique", () => {
    const text = `// chain 8453 documentation\nexport const cfg = { chainId: 8453 };\n`;
    const result = generatePatch({
      action: action({
        category: "CHAIN_ID",
        sourceValue: "8453",
        targetValue: "10",
        evidence: [{ filePath: "config.ts", startLine: 2, excerpt: "chainId: 8453" }],
      }),
      filePath: "config.ts",
      fileText: text,
    });
    expect("patchedText" in result && result.patchedText).toContain("// chain 8453 documentation");
    expect("patchedText" in result && result.patchedText).toContain("chainId: 10");
  });

  it("G: JSON unique scalar replacement preserves surrounding formatting", () => {
    const text = `{\n  "chainId": 8453,\n  "name": "Base"\n}\n`;
    const result = generatePatch({
      action: action({
        category: "CHAIN_ID",
        sourceValue: "8453",
        targetValue: "10",
        evidence: [{ filePath: "network.json", startLine: 2, excerpt: '"chainId": 8453' }],
      }),
      filePath: "network.json",
      fileText: text,
    });
    expect("patchedText" in result && result.patchedText).toBe(
      `{\n  "chainId": 10,\n  "name": "Base"\n}\n`,
    );
  });

  it("patches USDC on a Solidity evidence line and refuses WETH", () => {
    const text = `IERC20 public constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);\n`;
    const usdc = generatePatch({
      action: action({
        category: "TOKEN_ADDRESS",
        semanticKey: "token:USDC",
        sourceValue: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        targetValue: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        evidence: [{ filePath: "src/Token.sol", startLine: 1, excerpt: text.trim() }],
      }),
      filePath: "src/Token.sol",
      fileText: text,
    });
    expect("patchedText" in usdc && usdc.patchedText).toContain(
      "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    );
    const weth = generatePatch({
      action: action({
        category: "TOKEN_ADDRESS",
        semanticKey: "token:WETH:a->b",
        sourceValue: "0x4200000000000000000000000000000000000006",
        targetValue: "0x4200000000000000000000000000000000000006",
      }),
      filePath: "src/Token.sol",
      fileText: text,
    });
    expect(weth).toMatchObject({ skip: true, code: "PATCHER_UNSUPPORTED" });
  });

  it("applies sequential env patches against the working file", () => {
    const original = "CHAIN_ID=8453\nRPC_URL=https://mainnet.base.org\nOTHER=keep\n";
    const first = applyPatchToWorkingText({
      action: action({
        category: "ENV_CONFIG",
        sourceValue: "CHAIN_ID=8453",
        targetValue: "10",
        evidence: [{ filePath: ".env.example", startLine: 1, excerpt: "CHAIN_ID=8453" }],
      }),
      filePath: ".env.example",
      fileText: original,
    });
    expect("patchedText" in first).toBe(true);
    const second = applyPatchToWorkingText({
      action: action({
        category: "ENV_CONFIG",
        sourceValue: "RPC_URL=https://mainnet.base.org",
        targetValue: "https://mainnet.optimism.io",
        evidence: [
          { filePath: ".env.example", startLine: 2, excerpt: "RPC_URL=https://mainnet.base.org" },
        ],
      }),
      filePath: ".env.example",
      fileText: "patchedText" in first ? first.patchedText : original,
    });
    expect("patchedText" in second && second.patchedText).toBe(
      "CHAIN_ID=10\nRPC_URL=https://mainnet.optimism.io\nOTHER=keep\n",
    );
  });

  it("skips non-unique JSON scalars instead of rewriting the file", () => {
    const result = generatePatch({
      action: action({
        category: "CHAIN_ID",
        sourceValue: "8453",
        targetValue: "10",
      }),
      filePath: "network.json",
      fileText: `{ "a": 8453, "b": 8453 }\n`,
    });
    expect(result).toMatchObject({ skip: true, code: "PATCH_PRECONDITION_FAILED" });
  });

  it("refuses .env.local", () => {
    const result = generatePatch({
      action: action({
        category: "ENV_CONFIG",
        sourceValue: "CHAIN_ID=8453",
        targetValue: "10",
      }),
      filePath: ".env.local",
      fileText: "CHAIN_ID=8453\n",
    });
    expect(result).toMatchObject({ skip: true, code: "UNSAFE_ENV_FILE" });
  });

  it("never auto-patches REVIEW_REQUIRED actions", () => {
    const result = generatePatch({
      action: action({
        category: "ENV_CONFIG",
        automationLevel: "REVIEW_REQUIRED",
        sourceValue: "CHAIN_ID=8453",
        targetValue: "10",
      }),
      filePath: ".env.example",
      fileText: "CHAIN_ID=8453\n",
    });
    expect(result).toMatchObject({ skip: true, code: "CHANGESET_NOT_ELIGIBLE" });
  });
});
