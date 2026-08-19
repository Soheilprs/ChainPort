"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api";

export function EvaluateCompatibilityButton({
  projectId,
  analysisId,
  analysisComplete,
}: {
  projectId: string;
  analysisId?: string;
  analysisComplete: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onClick() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`${API_URL}/v1/projects/${projectId}/compatibility-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analysisId === undefined ? {} : { analysisId }),
      });
      const body = (await response.json()) as {
        data?: { id: string };
        message?: string;
        code?: string;
      };
      if (!response.ok || body.data?.id === undefined) {
        setError(body.message ?? body.code ?? "Unable to evaluate compatibility");
        return;
      }
      router.push(`/app/compatibility/${body.data.id}`);
    } catch {
      setError("API unavailable");
    } finally {
      setPending(false);
    }
  }

  if (!analysisComplete) {
    return (
      <p className="text-sm text-muted">
        Repository analysis must complete before target-chain compatibility can be evaluated.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={() => void onClick()} disabled={pending}>
        {pending ? "Evaluating…" : "Evaluate target compatibility"}
      </Button>
      {error !== null ? <p className="text-sm text-blocker">{error}</p> : null}
      <p className="text-xs text-muted">
        Compares recorded requirements with the selected target chain. This does not modify the
        repository.
      </p>
    </div>
  );
}
