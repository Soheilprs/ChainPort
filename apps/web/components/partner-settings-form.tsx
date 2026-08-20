"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_URL } from "@/lib/api";
import type { NetworkPartner } from "@/lib/network";

export function PartnerSettingsForm({ partner }: { partner: NetworkPartner }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(partner.displayName);
  const [slug, setSlug] = useState(partner.slug);
  const [shortDescription, setShortDescription] = useState(partner.shortDescription ?? "");
  const [logoUrl, setLogoUrl] = useState(partner.logoUrl ?? "");
  const [primaryAccent, setPrimaryAccent] = useState(partner.primaryAccent ?? "");
  const [docsUrl, setDocsUrl] = useState(partner.docsUrl ?? "");
  const [faucetUrl, setFaucetUrl] = useState(partner.faucetUrl ?? "");
  const [explorerUrl, setExplorerUrl] = useState(partner.explorerUrl ?? "");
  const [supportUrl, setSupportUrl] = useState(partner.supportUrl ?? "");
  const [discordUrl, setDiscordUrl] = useState(partner.discordUrl ?? "");
  const [developerDocsUrl, setDeveloperDocsUrl] = useState(partner.developerDocsUrl ?? "");
  const [status, setStatus] = useState(partner.status);
  const [developerPortalEnabled, setDeveloperPortalEnabled] = useState(
    partner.developerPortalEnabled,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`${API_URL}/v1/network-partners/${partner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          slug,
          shortDescription: shortDescription === "" ? null : shortDescription,
          logoUrl: logoUrl === "" ? null : logoUrl,
          primaryAccent: primaryAccent === "" ? null : primaryAccent,
          docsUrl: docsUrl === "" ? null : docsUrl,
          faucetUrl: faucetUrl === "" ? null : faucetUrl,
          explorerUrl: explorerUrl === "" ? null : explorerUrl,
          supportUrl: supportUrl === "" ? null : supportUrl,
          discordUrl: discordUrl === "" ? null : discordUrl,
          developerDocsUrl: developerDocsUrl === "" ? null : developerDocsUrl,
          status,
          developerPortalEnabled,
        }),
      });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(body.message ?? "Unable to save partner settings");
        return;
      }
      router.refresh();
    } catch {
      setError("API unavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Display name">
        <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      </Field>
      <Field label="Public slug">
        <Input value={slug} onChange={(event) => setSlug(event.target.value)} />
      </Field>
      <Field label="Short description">
        <textarea
          className="min-h-24 w-full rounded-md border border-line-strong bg-background px-3 py-2 text-sm"
          value={shortDescription}
          maxLength={280}
          onChange={(event) => setShortDescription(event.target.value)}
        />
      </Field>
      <Field label="Logo URL (HTTPS)">
        <Input
          value={logoUrl}
          onChange={(event) => setLogoUrl(event.target.value)}
          placeholder="https://"
        />
      </Field>
      <Field label="Accent (#RRGGBB)">
        <Input
          value={primaryAccent}
          onChange={(event) => setPrimaryAccent(event.target.value)}
          placeholder="#ff0420"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Docs">
          <Input value={docsUrl} onChange={(event) => setDocsUrl(event.target.value)} />
        </Field>
        <Field label="Developer docs">
          <Input
            value={developerDocsUrl}
            onChange={(event) => setDeveloperDocsUrl(event.target.value)}
          />
        </Field>
        <Field label="Explorer">
          <Input value={explorerUrl} onChange={(event) => setExplorerUrl(event.target.value)} />
        </Field>
        <Field label="Faucet">
          <Input value={faucetUrl} onChange={(event) => setFaucetUrl(event.target.value)} />
        </Field>
        <Field label="Support">
          <Input value={supportUrl} onChange={(event) => setSupportUrl(event.target.value)} />
        </Field>
        <Field label="Discord">
          <Input value={discordUrl} onChange={(event) => setDiscordUrl(event.target.value)} />
        </Field>
      </div>
      <Field label="Status">
        <select
          className="h-9 w-full rounded-md border border-line-strong bg-background px-3 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="PILOT">PILOT</option>
          <option value="PAUSED">PAUSED</option>
          <option value="DISABLED">DISABLED</option>
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={developerPortalEnabled}
          onChange={(event) => setDeveloperPortalEnabled(event.target.checked)}
        />
        Developer portal enabled
      </label>
      <p className="text-xs text-muted">
        Registry capabilities (chain ID, RPC, tokens) cannot be edited here. Branding is structured
        fields only — no custom HTML, CSS, or JavaScript.
      </p>
      <Button onClick={() => void onSubmit()} disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
      {error !== null ? <p className="text-sm text-blocker">{error}</p> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="text-muted-strong">{label}</span>
      {children}
    </label>
  );
}
