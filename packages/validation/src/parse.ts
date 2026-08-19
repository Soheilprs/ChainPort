export interface ParsedTests {
  countsAvailable: boolean;
  total: number | null;
  passed: number | null;
  failed: number | null;
  skipped: number | null;
  cases: Array<{
    suite: string | null;
    testName: string;
    status: string;
    failureSummary: string | null;
  }>;
}

export function parseForgeOutput(text: string): ParsedTests {
  const suite = /Suite result: \w+\. (\d+) passed; (\d+) failed; (\d+) skipped/.exec(text);
  const result = /Test result: \w+\. (\d+) passed; (\d+) failed; (\d+) skipped/.exec(text);
  const match = result ?? suite;
  const cases: ParsedTests["cases"] = [];
  for (const line of text.split("\n")) {
    const pass = /\[PASS\]\s+(\S+)/.exec(line);
    const fail = /\[FAIL[^\]]*\]\s+(\S+)/.exec(line);
    if (pass?.[1] !== undefined) {
      cases.push({ suite: null, testName: pass[1], status: "passed", failureSummary: null });
    }
    if (fail?.[1] !== undefined) {
      cases.push({ suite: null, testName: fail[1], status: "failed", failureSummary: line.trim() });
    }
  }
  if (
    match === null ||
    match[1] === undefined ||
    match[2] === undefined ||
    match[3] === undefined
  ) {
    return {
      countsAvailable: cases.length > 0,
      total: cases.length || null,
      passed: count(cases, "passed"),
      failed: count(cases, "failed"),
      skipped: 0,
      cases,
    };
  }
  const passed = Number(match[1]);
  const failed = Number(match[2]);
  const skipped = Number(match[3]);
  return {
    countsAvailable: true,
    total: passed + failed + skipped,
    passed,
    failed,
    skipped,
    cases,
  };
}

export function parseHardhatOutput(text: string): ParsedTests {
  const passing = /(\d+)\s+passing/.exec(text);
  const failing = /(\d+)\s+failing/.exec(text);
  const pending = /(\d+)\s+pending/.exec(text);
  if (passing === null || passing[1] === undefined) {
    return {
      countsAvailable: false,
      total: null,
      passed: null,
      failed: null,
      skipped: null,
      cases: [],
    };
  }
  const passed = Number(passing[1]);
  const failed = failing?.[1] !== undefined ? Number(failing[1]) : 0;
  const skipped = pending?.[1] !== undefined ? Number(pending[1]) : 0;
  return {
    countsAvailable: true,
    total: passed + failed + skipped,
    passed,
    failed,
    skipped,
    cases: [],
  };
}

function count(cases: ParsedTests["cases"], status: string): number {
  return cases.filter((item) => item.status === status).length;
}
