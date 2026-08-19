import {
  COMPATIBILITY_CATEGORIES,
  type CompatibilityCategory,
  type CoverageConfidence,
} from "@chainport/shared";

import type { CategoryScore, CompatibilityEvaluation } from "./types.js";

const SOLO_WEIGHTS: Record<CompatibilityCategory, number> = {
  CONTRACTS: 15,
  RPC: 20,
  TOKENS: 15,
  ORACLES: 15,
  PROTOCOLS: 10,
  CROSS_CHAIN: 10,
  FRONTEND: 15,
  CONFIGURATION: 15,
};

const SEVERITY_FACTOR: Record<"PASS" | "WARNING" | "BLOCKER", number> = {
  PASS: 1,
  WARNING: 0.7,
  BLOCKER: 0,
};

export function coverageConfidence(coverage: number): CoverageConfidence {
  if (coverage >= 85) {
    return "HIGH";
  }
  if (coverage >= 50) {
    return "MEDIUM";
  }
  return "LOW";
}

function baseWeight(
  category: CompatibilityCategory,
  applicable: Set<CompatibilityCategory>,
): number {
  if (category === "FRONTEND" || category === "CONFIGURATION") {
    const both = applicable.has("FRONTEND") && applicable.has("CONFIGURATION");
    if (!applicable.has(category)) {
      return 0;
    }
    if (both) {
      return category === "FRONTEND" ? 8 : 7;
    }
    return 15;
  }
  return applicable.has(category) ? SOLO_WEIGHTS[category] : 0;
}

function countByStatus(findings: readonly CompatibilityEvaluation[]) {
  return {
    pass: findings.filter((item) => item.status === "PASS").length,
    warning: findings.filter((item) => item.status === "WARNING").length,
    blocker: findings.filter((item) => item.status === "BLOCKER").length,
    unknown: findings.filter((item) => item.status === "UNKNOWN").length,
  };
}

export function scoreFindings(findings: readonly CompatibilityEvaluation[]): {
  score: number;
  coverage: number;
  coverageConfidence: CoverageConfidence;
  categories: CategoryScore[];
  counts: { pass: number; warning: number; blocker: number; unknown: number };
} {
  const counts = countByStatus(findings);
  const coverage =
    findings.length === 0
      ? 100
      : Math.round(((findings.length - counts.unknown) / findings.length) * 100);

  const byCategory = new Map<CompatibilityCategory, CompatibilityEvaluation[]>();
  for (const category of COMPATIBILITY_CATEGORIES) {
    byCategory.set(category, []);
  }
  for (const finding of findings) {
    byCategory.get(finding.category)?.push(finding);
  }

  const applicable = new Set<CompatibilityCategory>();
  const scored = new Set<CompatibilityCategory>();
  for (const category of COMPATIBILITY_CATEGORIES) {
    const items = byCategory.get(category) ?? [];
    if (items.length > 0) {
      applicable.add(category);
    }
    if (items.some((item) => item.status !== "UNKNOWN")) {
      scored.add(category);
    }
  }

  const rawWeights = new Map<CompatibilityCategory, number>();
  let weightSum = 0;
  for (const category of scored) {
    const weight = baseWeight(category, applicable);
    rawWeights.set(category, weight);
    weightSum += weight;
  }

  const categories: CategoryScore[] = COMPATIBILITY_CATEGORIES.map((category) => {
    const items = byCategory.get(category) ?? [];
    const itemCounts = countByStatus(items);
    const known = items.filter((item) => item.status !== "UNKNOWN");
    const participates = scored.has(category) && weightSum > 0;
    const raw = rawWeights.get(category) ?? 0;
    const weight = participates ? (raw / weightSum) * 100 : 0;
    const score =
      known.length === 0
        ? null
        : known.reduce((sum, item) => {
            if (item.status === "UNKNOWN") {
              return sum;
            }
            return sum + SEVERITY_FACTOR[item.status];
          }, 0) / known.length;
    return {
      category,
      applicable: applicable.has(category),
      weight: Math.round(weight * 100) / 100,
      score: score === null ? null : Math.round(score * 1000) / 1000,
      passCount: itemCounts.pass,
      warningCount: itemCounts.warning,
      blockerCount: itemCounts.blocker,
      unknownCount: itemCounts.unknown,
    };
  });

  let score = 100;
  if (scored.size > 0 && weightSum > 0) {
    let weighted = 0;
    for (const category of categories) {
      if (category.score === null || !scored.has(category.category)) {
        continue;
      }
      weighted += category.weight * category.score;
    }
    score = Math.round(weighted);
  } else if (findings.length > 0) {
    score = 0;
  }

  return {
    score,
    coverage,
    coverageConfidence: coverageConfidence(coverage),
    categories,
    counts,
  };
}
