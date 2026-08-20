"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const options = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
] as const;

export function RangeSelect({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("range", value);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <select
      className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm"
      value={current}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
