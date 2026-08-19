export function lineNumberAt(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

export function lineAt(text: string, line: number): string {
  return text.split("\n")[line - 1] ?? "";
}

export function findLineMatching(text: string, pattern: RegExp): number | undefined {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (pattern.test(lines[i] ?? "")) {
      return i + 1;
    }
  }
  return undefined;
}
