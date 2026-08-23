"use client";

import { useState } from "react";

import { partnerInitials } from "@chainport/shared";

export function PartnerLogo({
  url,
  name,
  accent,
  size = "md",
}: {
  url: string | null;
  name: string;
  accent: string;
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const dimension =
    size === "lg" ? "h-14 w-14 text-lg" : size === "sm" ? "h-8 w-8 text-xs" : "h-11 w-11 text-sm";
  if (url === null || failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-lg font-medium text-white ${dimension}`}
        style={{ backgroundColor: accent }}
        aria-hidden
      >
        {partnerInitials(name)}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={`${name} logo`}
      className={`shrink-0 rounded-lg object-contain ${dimension} bg-surface`}
      onError={() => setFailed(true)}
    />
  );
}
