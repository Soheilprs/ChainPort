export class MetricsRegistry {
  private readonly counters = new Map<string, number>();
  private readonly durations: number[] = [];
  public workerHeartbeat = new Map<string, number>();

  public increment(name: string, labels: Record<string, string> = {}): void {
    const key = `${name}|${JSON.stringify(labels)}`;
    this.counters.set(key, (this.counters.get(key) ?? 0) + 1);
  }

  public observeDuration(ms: number): void {
    this.durations.push(ms);
    if (this.durations.length > 5_000) {
      this.durations.shift();
    }
  }

  public touchWorker(workerId: string): void {
    this.workerHeartbeat.set(workerId, Date.now());
  }

  public renderPrometheus(): string {
    const lines: string[] = [];
    for (const [key, value] of this.counters) {
      const [name, raw] = key.split("|");
      const labels = raw === undefined ? {} : (JSON.parse(raw) as Record<string, string>);
      const encoded = Object.entries(labels)
        .map(([label, labelValue]) => `${label}="${labelValue}"`)
        .join(",");
      lines.push(`${name}${encoded.length > 0 ? `{${encoded}}` : ""} ${value}`);
    }
    if (this.durations.length > 0) {
      const sum = this.durations.reduce((total, item) => total + item, 0);
      lines.push(`chainport_api_request_duration_ms_sum ${sum}`);
      lines.push(`chainport_api_request_duration_ms_count ${this.durations.length}`);
    }
    lines.push(`chainport_workers_seen ${this.workerHeartbeat.size}`);
    return `${lines.join("\n")}\n`;
  }

  public snapshot() {
    return {
      counters: Object.fromEntries(this.counters),
      requestSamples: this.durations.length,
      workers: [...this.workerHeartbeat.entries()].map(([id, at]) => ({
        id,
        lastSeenAt: new Date(at).toISOString(),
      })),
    };
  }
}

export const metrics = new MetricsRegistry();
