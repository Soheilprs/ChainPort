import type { InventoriedFile, ScannerLimits, ScannerOutput } from "./types.js";
import { DETECTORS } from "./detectors/registry.js";
import { inventoryRepository } from "./inventory.js";
import { SCANNER_VERSION } from "./version.js";

export function defaultScannerLimits(): ScannerLimits {
  return {
    maxFiles: 8_000,
    maxFileBytes: 524_288,
    maxTotalBytes: 20_971_520,
    maxDepth: 20,
  };
}

export async function analyzeRepository(
  root: string,
  limits: ScannerLimits = defaultScannerLimits(),
): Promise<ScannerOutput> {
  const files = await inventoryRepository(root, limits);
  const analyzed = files.filter((file) => file.analyzed);
  const context = {
    root,
    files,
    analyzedFiles: () => analyzed,
  };
  const output: ScannerOutput = {
    scannerVersion: SCANNER_VERSION,
    files: files.map(stripText),
    fileCount: files.length,
    analyzedFileCount: analyzed.length,
    skippedFileCount: files.filter((file) => !file.analyzed).length,
    totalAnalyzedBytes: analyzed.reduce((sum, file) => sum + file.sizeBytes, 0),
    components: [],
    requirements: [],
    detectorRuns: [],
  };

  for (const detector of DETECTORS) {
    const started = Date.now();
    try {
      const result = detector.detect(context);
      output.requirements.push(...result.requirements);
      output.components.push(...result.components);
      output.detectorRuns.push({
        detectorId: detector.id,
        detectorVersion: detector.version,
        status: "COMPLETED",
        durationMs: Date.now() - started,
        errorMessage: null,
      });
    } catch (error) {
      output.detectorRuns.push({
        detectorId: detector.id,
        detectorVersion: detector.version,
        status: "FAILED",
        durationMs: Date.now() - started,
        errorMessage: error instanceof Error ? error.message : "detector failed",
      });
    }
  }
  return output;
}

function stripText(file: InventoriedFile): InventoriedFile {
  return {
    path: file.path,
    extension: file.extension,
    category: file.category,
    sizeBytes: file.sizeBytes,
    analyzed: file.analyzed,
    skipReason: file.skipReason,
  };
}
