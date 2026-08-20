export function MetricBar({
  value,
  max,
  tone = "accent",
}: {
  value: number;
  max: number;
  tone?: "accent" | "pass" | "warning" | "blocker" | "unknown";
}) {
  const width = max <= 0 ? 0 : Math.min(100, (value / max) * 100);
  const color =
    tone === "pass"
      ? "bg-pass"
      : tone === "warning"
        ? "bg-warning"
        : tone === "blocker"
          ? "bg-blocker"
          : tone === "unknown"
            ? "bg-unknown"
            : "bg-accent";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
    </div>
  );
}
