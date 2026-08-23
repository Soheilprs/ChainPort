import Link from "next/link";

import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/site-header";

const ERRORS: Record<string, string> = {
  failed: "Sign in failed. Try again.",
  "api-unavailable": "API unavailable. Start the API and try again.",
  "invalid-email": "Enter a valid email address.",
  "oidc-required": "This environment requires OIDC sign-in.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const params = await searchParams;
  const returnTo =
    params.returnTo !== undefined &&
    params.returnTo.startsWith("/") &&
    !params.returnTo.startsWith("//")
      ? params.returnTo
      : "/app/projects";
  const error = params.error !== undefined ? (ERRORS[params.error] ?? "Sign in failed.") : null;

  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-16">
        <form
          method="post"
          action="/auth/login"
          className="relative z-10 mx-auto w-full max-w-md rounded-xl border border-line-strong bg-surface p-6"
        >
          <h1 className="text-xl font-medium tracking-tight">Sign in to ChainPort</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Local development uses a test identity. Use the Continue button below.
          </p>
          <input type="hidden" name="returnTo" value={returnTo} />
          <label className="mt-6 block space-y-2 text-sm">
            <span className="text-muted-strong">Email</span>
            <Input
              type="email"
              name="email"
              defaultValue="developer@chainport.test"
              autoComplete="username"
              required
            />
          </label>
          <button
            type="submit"
            className="relative z-10 mt-5 flex h-11 w-full cursor-pointer items-center justify-center rounded-md text-sm font-semibold"
            style={{ backgroundColor: "#f4f4f5", color: "#09090b" }}
          >
            Continue
          </button>
          {error !== null ? <p className="mt-3 text-sm text-blocker">{error}</p> : null}
          <p className="mt-4 text-xs text-muted">
            <Link href="/" className="underline hover:text-foreground">
              Back to home
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
