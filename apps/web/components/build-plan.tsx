"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api";

export function BuildMigrationPlanButton({
  compatibilityRunId,
  compatibilityComplete,
}: {
  compatibilityRunId: string;
  compatibilityComplete: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onClick() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(
        `${API_URL}/v1/compatibility-runs/${compatibilityRunId}/migration-plans`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      const body = (await response.json()) as {
        data?: { id: string };
        message?: string;
        code?: string;
      };
      if (!response.ok || body.data?.id === undefined) {
        setError(body.message ?? body.code ?? "Unable to build migration plan");
        return;
      }
      router.push(`/app/migrations/${body.data.id}`);
    } catch {
      setError("API unavailable");
    } finally {
      setPending(false);
    }
  }

  if (!compatibilityComplete) {
    return (
      <p className="text-sm text-muted">
        Compatibility evaluation must complete before a migration plan can be built.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={() => void onClick()} disabled={pending}>
        {pending ? "Planning…" : "Build migration plan"}
      </Button>
      {error !== null ? <p className="text-sm text-blocker">{error}</p> : null}
      <p className="text-xs text-muted">
        Plans required changes from compatibility findings. This does not modify the repository.
      </p>
    </div>
  );
}
