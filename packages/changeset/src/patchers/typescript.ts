import ts from "typescript";

import { makePatch } from "../patch.js";
import type { PatchContext, PatchSkip, SafePatcher } from "../types.js";
import { extractReplaceable } from "../values.js";

const CHAIN_ID_NAMES = new Set(["chainId", "chain_id", "id"]);

export const typeScriptConfigPatcher: SafePatcher = {
  id: "typescript-config",
  version: "1",
  supports(context) {
    return context.filePath.endsWith(".ts") || context.filePath.endsWith(".tsx");
  },
  generate(context) {
    return patchScript(this, context, ts.ScriptKind.TS);
  },
};

export const javaScriptConfigPatcher: SafePatcher = {
  id: "javascript-config",
  version: "1",
  supports(context) {
    return (
      context.filePath.endsWith(".js") ||
      context.filePath.endsWith(".mjs") ||
      context.filePath.endsWith(".cjs") ||
      context.filePath.endsWith(".jsx")
    );
  },
  generate(context) {
    return patchScript(this, context, ts.ScriptKind.JS);
  },
};

function patchScript(
  patcher: SafePatcher,
  context: PatchContext,
  kind: ts.ScriptKind,
): ReturnType<SafePatcher["generate"]> {
  const replaceable = extractReplaceable(context.action);
  if (replaceable === null) {
    return skip("PATCH_PRECONDITION_FAILED", "Missing source or target value");
  }
  const sourceFile = ts.createSourceFile(
    context.filePath,
    context.fileText,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
  const evidenceLine = context.evidence[0]?.startLine;
  const hits: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isDynamicNumeric(node)) {
      ts.forEachChild(node, visit);
      return;
    }
    if (ts.isNumericLiteral(node) && node.text === replaceable.source) {
      if (context.action.category === "CHAIN_ID" && !isChainIdProperty(node)) {
        ts.forEachChild(node, visit);
        return;
      }
      hits.push(node);
    }
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      node.text === replaceable.source
    ) {
      hits.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  const chosen = selectNode(sourceFile, hits, evidenceLine);
  if (chosen === undefined) {
    return skip(
      hits.length === 0 ? "SOURCE_MISMATCH" : "PATCH_PRECONDITION_FAILED",
      hits.length === 0
        ? "Source value was not found as a literal"
        : "Multiple matching literals; refusing ambiguous rewrite",
    );
  }
  const start = chosen.getStart(sourceFile);
  const end = chosen.getEnd();
  const original = context.fileText.slice(start, end);
  const nextLiteral = replacementLiteral(original, replaceable.target);
  const patched = context.fileText.slice(0, start) + nextLiteral + context.fileText.slice(end);
  return makePatch(
    context,
    patcher.id,
    patcher.version,
    patched,
    replaceable.source,
    replaceable.target,
    "Replace AST literal",
  );
}

function isChainIdProperty(node: ts.Node): boolean {
  const parent = node.parent;
  if (parent !== undefined && ts.isPropertyAssignment(parent)) {
    const name = parent.name;
    const text = ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : "";
    return CHAIN_ID_NAMES.has(text);
  }
  return false;
}

function isDynamicNumeric(node: ts.CallExpression): boolean {
  return ts.isIdentifier(node.expression) && node.expression.text === "Number";
}

function selectNode(
  sourceFile: ts.SourceFile,
  hits: ts.Node[],
  evidenceLine: number | undefined,
): ts.Node | undefined {
  if (hits.length === 1) {
    return hits[0];
  }
  if (evidenceLine === undefined) {
    return undefined;
  }
  const onLine = hits.filter((node) => {
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    return line === evidenceLine;
  });
  return onLine.length === 1 ? onLine[0] : undefined;
}

function replacementLiteral(original: string, target: string): string {
  if (original.startsWith("'") || original.startsWith('"') || original.startsWith("`")) {
    const quote = original[0] ?? '"';
    return `${quote}${target}${quote}`;
  }
  return target;
}

function skip(code: string, reason: string): PatchSkip {
  return { skip: true, code, reason };
}
