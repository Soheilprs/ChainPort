"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { createProject, fetchCurrentUser, type ChainSummary } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewMigrationForm({
  chains,
  initialRepositoryUrl = "",
}: {
  chains: readonly ChainSummary[];
  initialRepositoryUrl?: string;
}) {
  const router = useRouter();
  const sources = useMemo(() => chains.filter((chain) => chain.roles.includes("source")), [chains]);
  const targets = useMemo(() => chains.filter((chain) => chain.roles.includes("target")), [chains]);
  const [repositoryUrl, setRepositoryUrl] = useState(initialRepositoryUrl);
  const [sourceChainKey, setSourceChainKey] = useState(sources[0]?.key ?? "");
  const [targetChainKey, setTargetChainKey] = useState(
    targets.find((chain) => chain.key !== sources[0]?.key)?.key ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void fetchCurrentUser()
      .then((user) => setSignedIn(user !== null))
      .catch(() => setSignedIn(false));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (signedIn !== true) {
      const next = `/app/projects/new?repositoryUrl=${encodeURIComponent(repositoryUrl)}`;
      router.push(`/auth/sign-in?returnTo=${encodeURIComponent(next)}`);
      return;
    }
    setError(null);
    setPending(true);
    try {
      const result = await createProject({ repositoryUrl, sourceChainKey, targetChainKey });
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
    <form method="post" onSubmit={(event) => void onSubmit(event)} className="max-w-xl space-y-5">
      <label className="block space-y-2 text-sm">
        <span className="text-muted-strong">GitHub repository URL</span>
        <Input
          name="repositoryUrl"
          placeholder="https://github.com/owner/repository"
          value={repositoryUrl}
          onChange={(event) => setRepositoryUrl(event.target.value)}
          required
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm">
          <span className="text-muted-strong">Source network</span>
          <select
            className="h-9 w-full rounded-md border border-line-strong bg-background px-3 text-sm"
            value={sourceChainKey}
            onChange={(event) => setSourceChainKey(event.target.value)}
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
          <select
            className="h-9 w-full rounded-md border border-line-strong bg-background px-3 text-sm"
            value={targetChainKey}
            onChange={(event) => setTargetChainKey(event.target.value)}
          >
            {targets.map((chain) => (
              <option key={chain.key} value={chain.key}>
                {chain.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error !== null ? <p className="text-sm text-blocker">{error}</p> : null}
      {signedIn === false ? (
        <p className="text-sm text-warning">Sign in is required before ingest can start.</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Starting…" : signedIn ? "Start ingest" : "Sign in to start ingest"}
      </Button>
    </form>
  );
}
