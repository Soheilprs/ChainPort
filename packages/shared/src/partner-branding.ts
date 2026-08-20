import { DomainValidationError } from "./errors.js";

export const DEFAULT_PARTNER_ACCENT = "#818cf8";
export const PARTNER_SLUG_MIN_LENGTH = 2;
export const PARTNER_SLUG_MAX_LENGTH = 64;
export const PARTNER_DESCRIPTION_MAX_LENGTH = 280;
export const PARTNER_DISPLAY_NAME_MAX_LENGTH = 80;
export const PARTNER_URL_MAX_LENGTH = 2048;

export const PARTNER_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const RESERVED_PARTNER_SLUGS = new Set(["migrate", "new", "preview", "settings"]);

const BLOCKED_URL_SCHEMES = ["javascript:", "data:", "file:", "vbscript:", "blob:"];

const SEMANTIC_RGB: readonly (readonly [number, number, number])[] = [
  [74, 222, 128],
  [251, 191, 36],
  [248, 113, 113],
  [148, 163, 184],
];

const DARK_BACKGROUND_RGB = [9, 9, 11] as const;

export class PartnerBrandingError extends DomainValidationError {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PartnerBrandingError";
  }
}

export interface PartnerBrandingInput {
  slug?: string;
  displayName?: string;
  logoUrl?: string | null;
  primaryAccent?: string | null;
  shortDescription?: string | null;
  docsUrl?: string | null;
  faucetUrl?: string | null;
  explorerUrl?: string | null;
  supportUrl?: string | null;
  discordUrl?: string | null;
  developerDocsUrl?: string | null;
}

export interface PartnerBranding {
  slug?: string;
  displayName?: string;
  logoUrl: string | null;
  primaryAccent: string | null;
  shortDescription: string | null;
  docsUrl: string | null;
  faucetUrl: string | null;
  explorerUrl: string | null;
  supportUrl: string | null;
  discordUrl: string | null;
  developerDocsUrl: string | null;
}

export function parsePartnerSlug(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new PartnerBrandingError("INVALID_PARTNER_SLUG", "slug is required");
  }
  const slug = value.trim().toLowerCase();
  if (slug.length < PARTNER_SLUG_MIN_LENGTH || slug.length > PARTNER_SLUG_MAX_LENGTH) {
    throw new PartnerBrandingError(
      "INVALID_PARTNER_SLUG",
      "slug must be 2-64 lowercase URL-safe characters",
    );
  }
  if (!PARTNER_SLUG_PATTERN.test(slug)) {
    throw new PartnerBrandingError(
      "INVALID_PARTNER_SLUG",
      "slug must be lowercase letters, digits, and hyphens",
    );
  }
  if (RESERVED_PARTNER_SLUGS.has(slug)) {
    throw new PartnerBrandingError("INVALID_PARTNER_SLUG", "slug is reserved");
  }
  return slug;
}

export function slugFromNetworkKey(networkKey: string): string {
  return parsePartnerSlug(networkKey);
}

export function parseDisplayName(value: unknown, fallback: string): string {
  const raw = typeof value === "string" && value.trim() !== "" ? value.trim() : fallback.trim();
  if (raw.length === 0 || raw.length > PARTNER_DISPLAY_NAME_MAX_LENGTH) {
    throw new PartnerBrandingError("INVALID_REQUEST", "displayName must be 1-80 characters");
  }
  return raw;
}

export function parseShortDescription(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new PartnerBrandingError("INVALID_REQUEST", "shortDescription is invalid");
  }
  const text = [...value]
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code === 9 || code === 10 || code === 13 || code >= 32;
    })
    .join("")
    .trim();
  if (text.length > PARTNER_DESCRIPTION_MAX_LENGTH) {
    throw new PartnerBrandingError(
      "INVALID_REQUEST",
      "shortDescription must be 280 characters or fewer",
    );
  }
  return text.length === 0 ? null : text;
}

export function parseHexAccent(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new PartnerBrandingError("INVALID_PARTNER_ACCENT", "primaryAccent is invalid");
  }
  const hex = value.trim();
  const short = /^#([0-9a-fA-F]{3})$/.exec(hex);
  const long = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (short !== null) {
    const digits = short[1] ?? "";
    const r = digits[0];
    const g = digits[1];
    const b = digits[2];
    if (r === undefined || g === undefined || b === undefined) {
      throw new PartnerBrandingError("INVALID_PARTNER_ACCENT", "primaryAccent is invalid");
    }
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (long !== null) {
    return hex.toLowerCase();
  }
  throw new PartnerBrandingError(
    "INVALID_PARTNER_ACCENT",
    "primaryAccent must be a hex color such as #ff5a1f",
  );
}

export function parsePartnerHttpUrl(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new PartnerBrandingError("INVALID_PARTNER_URL", `${field} is invalid`);
  }
  const raw = value.trim();
  if (raw.length > PARTNER_URL_MAX_LENGTH) {
    throw new PartnerBrandingError("INVALID_PARTNER_URL", `${field} is too long`);
  }
  const lower = raw.toLowerCase();
  for (const scheme of BLOCKED_URL_SCHEMES) {
    if (lower.startsWith(scheme)) {
      throw new PartnerBrandingError("INVALID_PARTNER_URL", `${field} uses a blocked URL scheme`);
    }
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new PartnerBrandingError("INVALID_PARTNER_URL", `${field} is not a valid URL`);
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new PartnerBrandingError("INVALID_PARTNER_URL", `${field} must not include credentials`);
  }
  const isLocalHttp =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  if (parsed.protocol !== "https:" && !isLocalHttp) {
    throw new PartnerBrandingError("INVALID_PARTNER_URL", `${field} must use HTTPS`);
  }
  return parsed.toString();
}

export function parseLogoUrl(value: unknown): string | null {
  if (typeof value === "string" && value.trim().toLowerCase().startsWith("data:")) {
    throw new PartnerBrandingError("INVALID_PARTNER_LOGO", "logoUrl must not be a data URL");
  }
  return parsePartnerHttpUrl(value, "logoUrl");
}

export function parsePartnerBranding(input: PartnerBrandingInput): PartnerBranding {
  return {
    ...(input.slug === undefined ? {} : { slug: parsePartnerSlug(input.slug) }),
    ...(input.displayName === undefined
      ? {}
      : { displayName: parseDisplayName(input.displayName, input.displayName) }),
    logoUrl: parseLogoUrl(input.logoUrl),
    primaryAccent: parseHexAccent(input.primaryAccent),
    shortDescription: parseShortDescription(input.shortDescription),
    docsUrl: parsePartnerHttpUrl(input.docsUrl, "docsUrl"),
    faucetUrl: parsePartnerHttpUrl(input.faucetUrl, "faucetUrl"),
    explorerUrl: parsePartnerHttpUrl(input.explorerUrl, "explorerUrl"),
    supportUrl: parsePartnerHttpUrl(input.supportUrl, "supportUrl"),
    discordUrl: parsePartnerHttpUrl(input.discordUrl, "discordUrl"),
    developerDocsUrl: parsePartnerHttpUrl(input.developerDocsUrl, "developerDocsUrl"),
  };
}

export function hexToRgb(hex: string): readonly [number, number, number] {
  const normalized = parseHexAccent(hex);
  if (normalized === null) {
    throw new PartnerBrandingError("INVALID_PARTNER_ACCENT", "primaryAccent is invalid");
  }
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

export function relativeLuminance(rgb: readonly [number, number, number]): number {
  const channel = (value: number): number => {
    const linear = value / 255;
    return linear <= 0.03928 ? linear / 12.92 : ((linear + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

export function contrastRatio(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): number {
  const a = relativeLuminance(left);
  const b = relativeLuminance(right);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isAccentSafe(hex: string): boolean {
  let rgb: readonly [number, number, number];
  try {
    rgb = hexToRgb(hex);
  } catch {
    return false;
  }
  if (contrastRatio(rgb, DARK_BACKGROUND_RGB) < 3) {
    return false;
  }
  for (const semantic of SEMANTIC_RGB) {
    const distance = Math.sqrt(
      (rgb[0] - semantic[0]) ** 2 + (rgb[1] - semantic[1]) ** 2 + (rgb[2] - semantic[2]) ** 2,
    );
    if (distance < 48) {
      return false;
    }
  }
  return true;
}

export function resolvePartnerAccent(hex: string | null | undefined): string {
  if (hex === null || hex === undefined || hex === "") {
    return DEFAULT_PARTNER_ACCENT;
  }
  try {
    const normalized = parseHexAccent(hex);
    if (normalized === null || !isAccentSafe(normalized)) {
      return DEFAULT_PARTNER_ACCENT;
    }
    return normalized;
  } catch {
    return DEFAULT_PARTNER_ACCENT;
  }
}

export function partnerInitials(displayName: string): string {
  const parts = displayName
    .split(/\s+/)
    .map((part) => part.replaceAll(/[^A-Za-z0-9]/g, ""))
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return "N";
  }
  const first = parts[0];
  const second = parts[1];
  if (first === undefined) {
    return "N";
  }
  if (second === undefined) {
    return first.slice(0, 2).toUpperCase();
  }
  return `${first[0] ?? ""}${second[0] ?? ""}`.toUpperCase();
}

export function presentPartnerLinks(partner: {
  docsUrl: string | null;
  faucetUrl: string | null;
  explorerUrl: string | null;
  supportUrl: string | null;
  discordUrl: string | null;
  developerDocsUrl: string | null;
}): Record<string, string> {
  const links: Record<string, string> = {};
  if (partner.docsUrl !== null) links.docs = partner.docsUrl;
  if (partner.faucetUrl !== null) links.faucet = partner.faucetUrl;
  if (partner.explorerUrl !== null) links.explorer = partner.explorerUrl;
  if (partner.supportUrl !== null) links.support = partner.supportUrl;
  if (partner.discordUrl !== null) links.discord = partner.discordUrl;
  if (partner.developerDocsUrl !== null) links.developerDocs = partner.developerDocsUrl;
  return links;
}

export function portalIsPubliclyVisible(partner: {
  status: string;
  developerPortalEnabled: boolean;
}): boolean {
  if (!partner.developerPortalEnabled) {
    return false;
  }
  return partner.status === "ACTIVE" || partner.status === "PILOT" || partner.status === "PAUSED";
}

export function portalCreationEnabled(partner: {
  status: string;
  developerPortalEnabled: boolean;
}): boolean {
  if (!partner.developerPortalEnabled) {
    return false;
  }
  return partner.status === "ACTIVE" || partner.status === "PILOT";
}
