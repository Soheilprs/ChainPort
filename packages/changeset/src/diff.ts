function splitLines(text: string): { lines: string[]; trailingNewline: boolean } {
  const trailingNewline = text.endsWith("\n");
  const body = trailingNewline ? text.slice(0, -1) : text;
  return { lines: body.length === 0 && !trailingNewline ? [] : body.split("\n"), trailingNewline };
}

export function unifiedDiff(filePath: string, before: string, after: string): string {
  const left = splitLines(before);
  const right = splitLines(after);
  const header = `--- a/${filePath}\n+++ b/${filePath}`;
  if (before === after) {
    return `${header}\n`;
  }
  let prefix = 0;
  while (
    prefix < left.lines.length &&
    prefix < right.lines.length &&
    left.lines[prefix] === right.lines[prefix]
  ) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < left.lines.length - prefix &&
    suffix < right.lines.length - prefix &&
    left.lines[left.lines.length - 1 - suffix] === right.lines[right.lines.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const context = 3;
  const hunkOldStart = Math.max(0, prefix - context);
  const hunkNewStart = hunkOldStart;
  const oldMiddle = left.lines.slice(prefix, left.lines.length - suffix);
  const newMiddle = right.lines.slice(prefix, right.lines.length - suffix);
  const oldContextAfter = left.lines.slice(
    left.lines.length - suffix,
    left.lines.length - suffix + context,
  );
  const newContextBefore = left.lines.slice(hunkOldStart, prefix);
  const oldCount = newContextBefore.length + oldMiddle.length + oldContextAfter.length;
  const newCount = newContextBefore.length + newMiddle.length + oldContextAfter.length;
  const rows: string[] = [
    header,
    `@@ -${hunkOldStart + 1},${oldCount} +${hunkNewStart + 1},${newCount} @@`,
  ];
  for (const line of newContextBefore) {
    rows.push(` ${line}`);
  }
  for (const line of oldMiddle) {
    rows.push(`-${line}`);
  }
  for (const line of newMiddle) {
    rows.push(`+${line}`);
  }
  for (const line of oldContextAfter) {
    rows.push(` ${line}`);
  }
  return `${rows.join("\n")}\n`;
}

export function lineExcerpt(text: string, line: number): string {
  const lines = text.split("\n");
  return lines[Math.max(0, line - 1)] ?? "";
}
