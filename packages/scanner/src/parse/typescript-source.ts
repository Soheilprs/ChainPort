import ts from "typescript";

export interface NumericProperty {
  name: string;
  value: number;
  line: number;
}

export interface StringLiteralHit {
  value: string;
  line: number;
}

export interface ImportHit {
  module: string;
  line: number;
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

export function parseTypeScriptSource(filePath: string, text: string) {
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") || filePath.endsWith(".jsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const numericProperties: NumericProperty[] = [];
  const stringLiterals: StringLiteralHit[] = [];
  const imports: ImportHit[] = [];
  const identifiers = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push({ module: node.moduleSpecifier.text, line: lineOf(sourceFile, node) });
    }
    if (ts.isImportSpecifier(node)) {
      identifiers.add(node.name.text);
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      identifiers.add(node.expression.text);
    }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name)) {
      identifiers.add(node.name.text);
    }
    if (
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
      ts.isNumericLiteral(node.initializer)
    ) {
      const name = ts.isIdentifier(node.name) ? node.name.text : node.name.text;
      numericProperties.push({
        name,
        value: Number(node.initializer.text),
        line: lineOf(sourceFile, node),
      });
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      stringLiterals.push({ value: node.text, line: lineOf(sourceFile, node) });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { numericProperties, stringLiterals, imports, identifiers: [...identifiers] };
}
