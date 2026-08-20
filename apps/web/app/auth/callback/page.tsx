"use client";

import { useEffect } from "react";

import { API_URL } from "@/lib/api";

export default function AuthCallbackPage() {
  useEffect(() => {
    window.location.replace(`${API_URL}/v1/auth/oidc/callback${window.location.search}`);
  }, []);
  return (
    <main className="mx-auto max-w-6xl px-5 py-16">
      <p className="text-sm">Completing sign-in…</p>
    </main>
  );
}
