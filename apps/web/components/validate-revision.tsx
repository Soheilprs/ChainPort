"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api";

export function ValidateRevisionButton({
  revisionId,
  label,
}: {
  revisionId: string;
  label: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onClick() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`${API_URL}/v1/revisions/${revisionId}/validations`, {
        method: "POST",
      });
      const body = (await response.json()) as {
        data?: { id: string };
        message?: string;
        code?: string;
      };
      if (!response.ok || body.data?.id === undefined) {
        setError(body.message ?? body.code ?? "Unable to start validation");
        return;
      }
      router.push(`/app/validations/${body.data.id}`);
    } catch {
      setError("API unavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={() => void onClick()} disabled={pending} variant="outline">
        {pending ? "Starting…" : label}
      </Button>
      {error !== null ? <p className="text-sm text-blocker">{error}</p> : null}
    </div>
  );
}
