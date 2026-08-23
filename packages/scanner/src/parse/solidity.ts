export interface SolidityImport {
  path: string;
  line: number;
}

export interface SolidityTypeDefinition {
  kind: "contract" | "interface" | "library";
  name: string;
  line: number;
}

export interface SolidityAddressConstant {
  name: string;
  address: string;
  line: number;
}

export interface SolidityFileFacts {
  pragma: string | null;
  pragmaLine: number | null;
  imports: SolidityImport[];
  definitions: SolidityTypeDefinition[];
  addressConstants: SolidityAddressConstant[];
}

const IMPORT_PATTERN = /^\s*import\s+(?:\{[^}]*\}\s+from\s+)?["']([^"']+)["']/;
const DEFINITION_PATTERN =
  /^\s*(?:abstract\s+)?(contract|interface|library)\s+([A-Za-z_][A-Za-z0-9_]*)/;
const PRAGMA_PATTERN = /^\s*pragma\s+solidity\s+([^;]+);/;
const ADDRESS_CONSTANT_PATTERN =
  /\b(?:address|IERC20|IERC20Metadata|I[A-Z][A-Za-z0-9_]*)\b[\s\w]*(?:constant|immutable)?[\s\w]*\b([A-Za-z_][A-Za-z0-9_]*)\s*=[\s\w(]*(0x[a-fA-F0-9]{40})(?![a-fA-F0-9])/;
const NAMED_ADDRESS_PATTERN =
  /\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:payable\s*)?(0x[a-fA-F0-9]{40})(?![a-fA-F0-9])/;

export function parseSoliditySource(text: string): SolidityFileFacts {
  const lines = text.split("\n");
  const facts: SolidityFileFacts = {
    pragma: null,
    pragmaLine: null,
    imports: [],
    definitions: [],
    addressConstants: [],
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
    if (!/\bbytes32\b/i.test(line)) {
      const typed = ADDRESS_CONSTANT_PATTERN.exec(line);
      const named = NAMED_ADDRESS_PATTERN.exec(line);
      const hit = typed ?? named;
      if (hit?.[1] !== undefined && hit[2] !== undefined) {
        facts.addressConstants.push({ name: hit[1], address: hit[2], line: i + 1 });
      }
    }
  }
  return facts;
}
