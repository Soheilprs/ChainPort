import { describe, expect, it } from "vitest";

import {
  PartnerBrandingError,
  isAccentSafe,
  parseHexAccent,
  parseLogoUrl,
  parsePartnerHttpUrl,
  parsePartnerSlug,
  partnerInitials,
  portalCreationEnabled,
  portalIsPubliclyVisible,
  resolvePartnerAccent,
} from "../src/index.js";

describe("partner branding", () => {
  it("accepts lowercase URL-safe slugs and rejects reserved or mixed-case routing names", () => {
    expect(parsePartnerSlug("optimism")).toBe("optimism");
    expect(parsePartnerSlug("  Base  ")).toBe("base");
    expect(() => parsePartnerSlug("Optimism_Main")).toThrow(PartnerBrandingError);
    expect(() => parsePartnerSlug("migrate")).toThrow(PartnerBrandingError);
    expect(() => parsePartnerSlug("x")).toThrow(PartnerBrandingError);
  });

  it("rejects javascript, data, and file URLs and requires HTTPS except localhost", () => {
    expect(parsePartnerHttpUrl("https://docs.optimism.io", "docsUrl")).toBe(
      "https://docs.optimism.io/",
    );
    expect(parsePartnerHttpUrl("http://localhost:3000/docs", "docsUrl")).toContain("localhost");
    expect(() => parsePartnerHttpUrl("javascript:alert(1)", "docsUrl")).toThrow(
      PartnerBrandingError,
    );
    expect(() => parsePartnerHttpUrl("data:text/html,hi", "docsUrl")).toThrow(PartnerBrandingError);
    expect(() => parsePartnerHttpUrl("file:///etc/passwd", "docsUrl")).toThrow(
      PartnerBrandingError,
    );
    expect(() => parsePartnerHttpUrl("http://example.com", "docsUrl")).toThrow(
      PartnerBrandingError,
    );
    expect(() => parseLogoUrl("data:image/png;base64,abc")).toThrow(PartnerBrandingError);
    expect(parseLogoUrl("https://cdn.example.com/logo.png")).toContain("https://");
  });

  it("normalizes hex accents and refuses colors that collide with semantic status", () => {
    expect(parseHexAccent("#Ff0")).toBe("#ffff00");
    expect(isAccentSafe("#818cf8")).toBe(true);
    expect(isAccentSafe("#4ade80")).toBe(false);
    expect(isAccentSafe("#f87171")).toBe(false);
    expect(isAccentSafe("#000000")).toBe(false);
    expect(resolvePartnerAccent("#4ade80")).toBe("#818cf8");
    expect(resolvePartnerAccent("#ff0420")).not.toBe("#818cf8");
  });

  it("gates portal visibility and creation by status", () => {
    expect(portalIsPubliclyVisible({ status: "ACTIVE", developerPortalEnabled: true })).toBe(true);
    expect(portalIsPubliclyVisible({ status: "PAUSED", developerPortalEnabled: true })).toBe(true);
    expect(portalIsPubliclyVisible({ status: "DISABLED", developerPortalEnabled: true })).toBe(
      false,
    );
    expect(portalIsPubliclyVisible({ status: "ACTIVE", developerPortalEnabled: false })).toBe(
      false,
    );
    expect(portalCreationEnabled({ status: "PILOT", developerPortalEnabled: true })).toBe(true);
    expect(portalCreationEnabled({ status: "PAUSED", developerPortalEnabled: true })).toBe(false);
    expect(partnerInitials("Optimism Foundation")).toBe("OF");
  });
});
