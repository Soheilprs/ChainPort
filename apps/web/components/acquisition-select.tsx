"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const options = [
  { value: "all", label: "All targeting this network" },
  { value: "partner", label: "Partner portal referred" },
  { value: "generic", label: "Generic ChainPort traffic" },
] as const;

export function AcquisitionSelect({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("acquisition", value);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">Acquisition</span>
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
    </label>
  );
}
