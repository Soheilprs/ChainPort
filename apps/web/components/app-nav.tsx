import Link from "next/link";

import { cn } from "@/lib/utils";

const items = [
  { href: "/app/projects", label: "Projects" },
  { href: "/app/chains", label: "Chains" },
] as const;

export function AppNav({ current }: { current: string }) {
  return (
    <div className="mb-8 flex gap-1 border-b border-line">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "-mb-px border-b px-3 py-2 text-sm text-muted",
            current === item.href
              ? "border-foreground text-foreground"
              : "border-transparent hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
