import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-20">
        <p className="text-xs uppercase tracking-[0.16em] text-muted">404</p>
        <h1 className="mt-3 text-2xl font-medium tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted">That route is not part of the product yet.</p>
        <Link href="/" className="mt-6 inline-block text-sm text-accent hover:underline">
          Back to home
        </Link>
      </main>
    </div>
  );
}
