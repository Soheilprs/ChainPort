"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import { createPartnerProject, type ChainSummary } from "@/lib/api";
import type { PublicPartner } from "@/lib/partners";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PartnerMigrationForm({
  partner,
  chains,
}: {
  partner: PublicPartner;
  chains: readonly ChainSummary[];
}) {
  const router = useRouter();
  const sources = useMemo(
    () =>
      chains.filter((chain) => chain.roles.includes("source") && chain.key !== partner.networkKey),
    [chains, partner.networkKey],
  );
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [sourceChainKey, setSourceChainKey] = useState(sources[0]?.key ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const paused = !partner.portal.creationEnabled;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (paused) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      const result = await createPartnerProject({
        slug: partner.slug,
        repositoryUrl,
        sourceChainKey,
      });
      if (!result.ok) {
        setError(`${result.error.code}: ${result.error.message}`);
        return;
      }
      router.push(`/app/jobs/${result.job.id}`);
    } catch {
      setError("API unavailable. Start the API and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="max-w-xl space-y-5">
      <label className="block space-y-2 text-sm">
        <span className="text-muted-strong">GitHub repository URL</span>
        <Input
          name="repositoryUrl"
          placeholder="https://github.com/owner/repository"
          value={repositoryUrl}
          onChange={(event) => setRepositoryUrl(event.target.value)}
          required
          disabled={paused}
          autoComplete="url"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm">
          <span className="text-muted-strong">Source network</span>
          <select
            className="h-9 w-full rounded-md border border-line-strong bg-background px-3 text-sm"
            value={sourceChainKey}
            onChange={(event) => setSourceChainKey(event.target.value)}
            disabled={paused}
          >
            {sources.map((chain) => (
              <option key={chain.key} value={chain.key}>
                {chain.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm">
          <span className="text-muted-strong">Target network</span>
          <Input value={partner.network.name} readOnly aria-readonly="true" />
          <span className="text-xs text-muted">
            Locked by this sponsored portal. Source remains selectable.
          </span>
        </label>
      </div>
      {paused ? (
        <p className="text-sm text-warning">
          This partner portal is paused. Existing projects remain available in the developer
          workspace.
        </p>
      ) : null}
      {error !== null ? <p className="text-sm text-blocker">{error}</p> : null}
      <Button
        type="submit"
        disabled={pending || paused}
        className={paused ? undefined : "text-white"}
        style={{ backgroundColor: paused ? undefined : partner.primaryAccent }}
      >
        {pending ? "Starting…" : `Start migration to ${partner.displayName}`}
      </Button>
    </form>
  );
}
