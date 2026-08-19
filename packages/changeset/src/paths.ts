import path from "node:path";

const SAFE_ENV = new Set([".env.example", ".env.template", ".env.sample", "example.env"]);
const UNSAFE_ENV = /^\.env(?:\.local|\.production|\.development(?:\.local)?)?$/;

export function posixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function isInsideRoot(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function resolveContained(root: string, relativePath: string): string | null {
  if (relativePath.includes("\0") || path.isAbsolute(relativePath)) {
    return null;
  }
  const normalized = posixPath(relativePath).replace(/^\/+/, "");
  if (normalized.split("/").some((part) => part === ".." || part === "")) {
    return null;
  }
  const resolved = path.resolve(root, normalized);
  if (!isInsideRoot(root, resolved)) {
    return null;
  }
  return resolved;
}

export function isSafeEnvTemplate(filePath: string): boolean {
  const base = path.posix.basename(posixPath(filePath));
  return SAFE_ENV.has(base);
}

export function isUnsafeEnvFile(filePath: string): boolean {
  const base = path.posix.basename(posixPath(filePath));
  return UNSAFE_ENV.test(base) && !isSafeEnvTemplate(filePath);
}

export function looksBinary(text: string): boolean {
  return text.includes("\0");
}
