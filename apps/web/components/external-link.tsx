import type { ReactNode } from "react";

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
    >
      {children}
      <span className="sr-only">(opens in a new tab)</span>
      <span aria-hidden className="text-xs text-muted">
        ↗
      </span>
    </a>
  );
}
