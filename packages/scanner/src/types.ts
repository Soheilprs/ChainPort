import type {
  ComponentKind,
  DetectionConfidence,
  FileCategory,
  RequirementCategory,
} from "@chainport/shared";

export interface ScannerLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  maxDepth: number;
}

export interface InventoriedFile {
  path: string;
  extension: string;
  category: FileCategory;
  sizeBytes: number;
  analyzed: boolean;
  skipReason: string | null;
  text?: string;
}

export interface EvidenceDraft {
  filePath: string;
  startLine: number;
  endLine: number;
  evidenceType: string;
  excerpt: string;
}

export interface RequirementDraft {
  category: RequirementCategory;
  key: string;
  requirementType: string;
  detectedValue: string;
  normalizedValue: string;
  confidence: DetectionConfidence;
  detector: string;
  detectorVersion: string;
  evidence: EvidenceDraft[];
}

export interface ComponentDraft {
  kind: ComponentKind;
  name: string;
  detail: string | null;
  filePath: string | null;
}

export interface DetectorRunDraft {
  detectorId: string;
  detectorVersion: string;
  status: "COMPLETED" | "FAILED";
  durationMs: number;
  errorMessage: string | null;
}

export interface ScannerOutput {
  scannerVersion: string;
  files: InventoriedFile[];
  fileCount: number;
  analyzedFileCount: number;
  skippedFileCount: number;
  totalAnalyzedBytes: number;
  components: ComponentDraft[];
  requirements: RequirementDraft[];
  detectorRuns: DetectorRunDraft[];
}

export interface DetectorContext {
  root: string;
  files: readonly InventoriedFile[];
  analyzedFiles(): readonly InventoriedFile[];
}

export interface Detector {
  id: string;
  version: string;
  detect(context: DetectorContext): {
    requirements: RequirementDraft[];
    components: ComponentDraft[];
  };
}
