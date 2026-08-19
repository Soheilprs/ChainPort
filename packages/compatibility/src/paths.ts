export function isFrontendPath(path: string): boolean {
  const base = path.split("/").at(-1) ?? "";
  return (
    path.startsWith("app/") ||
    path.includes("/app/") ||
    path.startsWith("pages/") ||
    path.includes("/pages/") ||
    base.includes("wagmi") ||
    base.includes("viem") ||
    path.includes("frontend")
  );
}

export function looksLikeAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}
