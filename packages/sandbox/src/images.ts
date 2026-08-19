export const SANDBOX_IMAGE_TAGS = {
  foundry: "chainport/sandbox-foundry:1",
  node20: "chainport/sandbox-node20:1",
  node22: "chainport/sandbox-node22:1",
} as const;

export type SandboxImageKind = keyof typeof SANDBOX_IMAGE_TAGS;

export function resolveImageTag(
  kind: SandboxImageKind,
  overrides: { foundry?: string; node20?: string; node22?: string } = {},
): string {
  if (kind === "foundry") {
    return overrides.foundry ?? SANDBOX_IMAGE_TAGS.foundry;
  }
  if (kind === "node20") {
    return overrides.node20 ?? SANDBOX_IMAGE_TAGS.node20;
  }
  return overrides.node22 ?? SANDBOX_IMAGE_TAGS.node22;
}
