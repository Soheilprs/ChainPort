"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { API_URL } from "@/lib/api";

export function CreatePartnerForm() {
  const router = useRouter();
  const [networkKey, setNetworkKey] = useState("optimism");
  const [displayName, setDisplayName] = useState("Optimism");
  const [slug, setSlug] = useState("optimism");
  const [shortDescription, setShortDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`${API_URL}/v1/network-partners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          networkKey,
          displayName,
          slug,
          ...(shortDescription === "" ? {} : { shortDescription }),
          developerPortalEnabled: true,
        }),
      });
      const body = (await response.json()) as { data?: { id: string }; message?: string };
      if (!response.ok || body.data?.id === undefined) {
        setError(body.message ?? "Unable to create partner");
        return;
      }
      router.push(`/network/${body.data.id}/settings`);
      router.refresh();
    } catch {
      setError("API unavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardTitle>Create partner</CardTitle>
      <CardDescription>
        Internal onboarding from an existing registry chain. DEVNET targets such as Anvil are
        refused. The public developer portal becomes /partners/&#123;slug&#125;.
      </CardDescription>
      <div className="mt-4 space-y-3">
        <Input
          value={networkKey}
          onChange={(event) => setNetworkKey(event.target.value)}
          placeholder="networkKey (optimism)"
          aria-label="Registry network key"
        />
        <Input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Display name"
          aria-label="Display name"
        />
        <Input
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="Public slug"
          aria-label="Public slug"
        />
        <Input
          value={shortDescription}
          onChange={(event) => setShortDescription(event.target.value)}
          placeholder="Short description (optional)"
          aria-label="Short description"
        />
        <Button onClick={() => void onSubmit()} disabled={pending}>
          {pending ? "Creating…" : "Create network partner"}
        </Button>
        {error !== null ? <p className="text-sm text-blocker">{error}</p> : null}
      </div>
    </Card>
  );
}
