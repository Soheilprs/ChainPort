import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PhaseBanner } from "@/components/phase-banner";
import { SiteHeader } from "@/components/site-header";
import { ValidationDetail, type ValidationPayload } from "@/components/validation-detail";
import { API_URL } from "@/lib/api";

export const metadata: Metadata = {
  title: "Validation",
};

export default async function ValidationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await fetch(`${API_URL}/v1/validations/${id}`, { cache: "no-store" }).catch(
    () => null,
  );
  if (response === null) {
    return (
      <div>
        <SiteHeader current="/app/projects" />
        <main className="mx-auto max-w-6xl px-5 py-10">
          <p className="text-sm text-muted">API unavailable.</p>
        </main>
      </div>
    );
  }
  if (response.status === 404) {
    notFound();
  }
  if (!response.ok) {
    throw new Error("Unable to load validation");
  }
  const body = (await response.json()) as { data: ValidationPayload };

  return (
    <div>
      <SiteHeader current="/app/projects" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <PhaseBanner />
        <Link
          href="/app/projects"
          className="mt-3 inline-block text-sm text-muted hover:text-foreground"
        >
          ← Projects
        </Link>
        <div className="mt-4">
          <ValidationDetail initial={body.data} />
        </div>
      </main>
    </div>
  );
}
