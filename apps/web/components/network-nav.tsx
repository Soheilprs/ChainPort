"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const items = [
  { href: "", label: "Overview" },
  { href: "/funnel", label: "Funnel" },
  { href: "/projects", label: "Projects" },
  { href: "/blockers", label: "Blockers" },
  { href: "/gaps", label: "Infrastructure" },
  { href: "/migrations", label: "Migrations" },
  { href: "/validations", label: "Validation" },
  { href: "/deployments", label: "Deployments" },
  { href: "/registry", label: "Registry" },
  { href: "/settings", label: "Settings" },
] as const;

export function NetworkNav({ partnerId }: { partnerId: string }) {
  const pathname = usePathname();
  return (
    <div className="mb-8 flex gap-1 overflow-x-auto border-b border-line">
      {items.map((item) => {
        const href = `/network/${partnerId}${item.href}`;
        const active = item.href === "" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "-mb-px whitespace-nowrap border-b px-3 py-2 text-sm text-muted",
              active
                ? "border-foreground text-foreground"
                : "border-transparent hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
