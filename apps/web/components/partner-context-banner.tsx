import Link from "next/link";

import type { PartnerSummary } from "@/lib/api";

export function PartnerContextBanner({
  partner,
  targetChainKey,
}: {
  partner?: PartnerSummary | null | undefined;
  targetChainKey: string;
}) {
  if (partner === null || partner === undefined) {
    return (
      <p className="text-sm text-muted">
        Target: <span className="text-foreground">{targetChainKey}</span>
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-line bg-surface/80 px-4 py-3 text-sm">
      <p>
        Migrating to <span className="text-foreground">{partner.displayName}</span>
      </p>
      <p className="mt-1 text-muted">
        Sponsored portal · Powered by ChainPort · Target locked to {partner.networkKey}
      </p>
      <Link
        href={`/partners/${partner.slug}`}
        className="mt-2 inline-block text-accent hover:underline"
      >
        Open {partner.displayName} portal
      </Link>
    </div>
  );
}
