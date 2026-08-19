"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api";

export function GenerateSafeFixesButton({
  planId,
  planComplete,
}: {
  planId: string;
  planComplete: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onClick() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`${API_URL}/v1/migration-plans/${planId}/change-sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await response.json()) as {
        data?: { id: string };
        message?: string;
        code?: string;
      };
      if (!response.ok || body.data?.id === undefined) {
        setError(body.message ?? body.code ?? "Unable to generate safe fixes");
        return;
      }
      router.push(`/app/change-sets/${body.data.id}`);
    } catch {
      setError("API unavailable");
    } finally {
      setPending(false);
    }
  }

  if (!planComplete) {
    return (
      <p className="text-sm text-muted">
        The migration plan must complete before safe patches can be generated.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={() => void onClick()} disabled={pending}>
        {pending ? "Generating…" : "Generate safe fixes"}
      </Button>
      {error !== null ? <p className="text-sm text-blocker">{error}</p> : null}
      <p className="text-xs text-muted">
        Only SAFE AUTOMATIC actions are considered. Original repository files are not modified.
      </p>
    </div>
  );
}
