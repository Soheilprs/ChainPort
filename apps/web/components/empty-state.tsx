import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="border-dashed">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-muted">{children}</div>
    </Card>
  );
}
