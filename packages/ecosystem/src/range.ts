import { ANALYTICS_RANGE_PRESETS, type AnalyticsRangePreset } from "@chainport/shared";

export interface UtcRange {
  preset: AnalyticsRangePreset;
  from: Date | null;
  to: Date | null;
}

export function parseAnalyticsRange(input: {
  range?: string;
  from?: string;
  to?: string;
  now?: Date;
}): UtcRange {
  if (input.from !== undefined || input.to !== undefined) {
    const from = input.from === undefined ? null : parseUtcInstant(input.from);
    const to = input.to === undefined ? null : parseUtcInstant(input.to);
    return { preset: "all", from, to };
  }
  const preset = isPreset(input.range) ? input.range : "all";
  if (preset === "all") {
    return { preset, from: null, to: null };
  }
  const now = input.now ?? new Date();
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  return {
    preset,
    from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
    to: now,
  };
}

export function projectCreatedAtFilter(range: UtcRange): { gte?: Date; lt?: Date } | undefined {
  if (range.from === null && range.to === null) {
    return undefined;
  }
  return {
    ...(range.from === null ? {} : { gte: range.from }),
    ...(range.to === null ? {} : { lt: range.to }),
  };
}

function isPreset(value: string | undefined): value is AnalyticsRangePreset {
  return value !== undefined && (ANALYTICS_RANGE_PRESETS as readonly string[]).includes(value);
}

function parseUtcInstant(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`invalid timestamp: ${value}`);
  }
  return parsed;
}
