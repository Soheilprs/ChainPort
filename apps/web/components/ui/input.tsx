import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-line-strong bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent/60",
        className,
      )}
      {...props}
    />
  );
}
