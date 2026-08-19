import type { MigrationActionCategory, MigrationAutomationLevel } from "@chainport/shared";

export interface PatchEvidence {
  filePath: string;
  startLine: number;
  excerpt: string;
}

export interface PatchableAction {
  id: string;
  semanticKey: string;
  category: MigrationActionCategory;
  automationLevel: MigrationAutomationLevel;
  sourceValue: string | null;
  targetValue: string | null;
  evidence: readonly PatchEvidence[];
}

export interface PatchContext {
  action: PatchableAction;
  filePath: string;
  fileText: string;
  evidence: readonly PatchEvidence[];
}

export interface GeneratedPatch {
  filePath: string;
  patcherId: string;
  patcherVersion: string;
  changeType: "REPLACE_VALUE";
  patchedText: string;
  unifiedDiff: string;
  beforeExcerpt: string;
  afterExcerpt: string;
  sourceHash: string;
  resultHash: string;
  sourceValue: string;
  targetValue: string;
  reason: string;
}

export interface PatchSkip {
  skip: true;
  reason: string;
  code: string;
}

export interface SafePatcher {
  id: string;
  version: string;
  supports(context: PatchContext): boolean;
  generate(context: PatchContext): GeneratedPatch | PatchSkip;
}

export function isSkip(value: GeneratedPatch | PatchSkip): value is PatchSkip {
  return "skip" in value && value.skip;
}
