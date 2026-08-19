export interface SolidityImport {
  path: string;
  line: number;
}

export interface SolidityTypeDefinition {
  kind: "contract" | "interface" | "library";
  name: string;
  line: number;
}

export interface SolidityFileFacts {
  pragma: string | null;
  pragmaLine: number | null;
  imports: SolidityImport[];
  definitions: SolidityTypeDefinition[];
}

const IMPORT_PATTERN = /^\s*import\s+(?:\{[^}]*\}\s+from\s+)?["']([^"']+)["']/;
const DEFINITION_PATTERN =
  /^\s*(?:abstract\s+)?(contract|interface|library)\s+([A-Za-z_][A-Za-z0-9_]*)/;
const PRAGMA_PATTERN = /^\s*pragma\s+solidity\s+([^;]+);/;

export function parseSoliditySource(text: string): SolidityFileFacts {
  const lines = text.split("\n");
  const facts: SolidityFileFacts = {
    pragma: null,
    pragmaLine: null,
    imports: [],
    definitions: [],
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const pragma = PRAGMA_PATTERN.exec(line);
    if (pragma?.[1] !== undefined && facts.pragma === null) {
      facts.pragma = pragma[1].trim();
      facts.pragmaLine = i + 1;
    }
    const imported = IMPORT_PATTERN.exec(line);
    if (imported?.[1] !== undefined) {
      facts.imports.push({ path: imported[1], line: i + 1 });
    }
    const definition = DEFINITION_PATTERN.exec(line);
    if (definition?.[1] !== undefined && definition[2] !== undefined) {
      facts.definitions.push({
        kind: definition[1] as SolidityTypeDefinition["kind"],
        name: definition[2],
        line: i + 1,
      });
    }
  }
  return facts;
}
