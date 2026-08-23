import Link from "next/link";

import { ChainPortMark } from "@/components/mark";
import { fetchApiHealth } from "@/lib/api";
import { serverApiFetch } from "@/lib/server-api";
import { cn } from "@/lib/utils";

const links = [
  { href: "/app/projects", label: "Developers" },
  { href: "/network", label: "Networks" },
  { href: "/app/chains", label: "Chains" },
  { href: "/auth/sign-in", label: "Sign in" },
] as const;

export async function SiteHeader({ current }: { current?: string }) {
  const health = await fetchApiHealth();
  const meResponse = await serverApiFetch("/v1/auth/me").catch(() => null);
  const meBody =
    meResponse?.ok === true
      ? ((await meResponse.json()) as { data?: { user?: { email: string } | null } })
      : null;
  const email = meBody?.data?.user?.email ?? null;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2 text-sm font-medium">
          <ChainPortMark className="h-4 w-4 text-accent" />
          ChainPort
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {links
            .filter((link) => (email !== null ? link.href !== "/auth/sign-in" : true))
            .map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-muted hover:text-foreground",
                  current === link.href && "text-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
          {email === null ? (
            <Link
              href="/auth/sign-in"
              className="rounded-md px-3 py-1.5 text-sm font-semibold"
              style={{ backgroundColor: "#f4f4f5", color: "#09090b" }}
            >
              Sign in
            </Link>
          ) : (
            <span className="rounded-md px-2.5 py-1.5 text-xs text-muted-strong" title={email}>
              {email}
            </span>
          )}
        </nav>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              health.status === "ok" ? "bg-pass" : "bg-blocker",
            )}
          />
          {health.status === "ok" ? "API online" : "API offline"}
        </div>
      </div>
    </header>
  );
}
