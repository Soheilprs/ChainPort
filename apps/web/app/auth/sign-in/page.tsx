"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { API_URL } from "@/lib/api";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("returnTo") ?? "/app/projects";
  const [email, setEmail] = useState("developer@chainport.test");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/v1/auth/test/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: email.split("@")[0] }),
      });
      if (response.status === 404) {
        window.location.href = `${API_URL}/v1/auth/oidc/start?returnTo=${encodeURIComponent(returnTo)}`;
        return;
      }
      if (!response.ok) {
        setError("Sign in failed");
        return;
      }
      router.push(returnTo);
      router.refresh();
    } catch {
      setError("API unavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardTitle>Sign in</CardTitle>
      <CardDescription>
        Development uses a deterministic test identity provider. Production uses OIDC and rejects
        this path.
      </CardDescription>
      <div className="mt-4 space-y-3">
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-label="Email"
        />
        <Button onClick={() => void onSubmit()} disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        {error !== null ? <p className="text-sm text-blocker">{error}</p> : null}
      </div>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16">
      <Suspense>
        <SignInForm />
      </Suspense>
    </main>
  );
}
