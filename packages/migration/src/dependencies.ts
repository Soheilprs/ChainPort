import { DomainValidationError } from "@chainport/shared";

export class CyclicMigrationDependencyError extends DomainValidationError {
  public constructor() {
    super("migration action dependencies contain a cycle");
    this.name = "CyclicMigrationDependencyError";
  }
}

export function topologicalOrder(
  keys: readonly string[],
  dependencies: readonly { actionKey: string; dependsOnKey: string }[],
): string[] {
  const keySet = new Set(keys);
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const key of keys) {
    incoming.set(key, 0);
    outgoing.set(key, []);
  }
  for (const edge of dependencies) {
    if (!keySet.has(edge.actionKey) || !keySet.has(edge.dependsOnKey)) {
      continue;
    }
    outgoing.get(edge.dependsOnKey)?.push(edge.actionKey);
    incoming.set(edge.actionKey, (incoming.get(edge.actionKey) ?? 0) + 1);
  }

  const queue = keys.filter((key) => (incoming.get(key) ?? 0) === 0);
  const ordered: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }
    ordered.push(current);
    for (const next of outgoing.get(current) ?? []) {
      const remaining = (incoming.get(next) ?? 0) - 1;
      incoming.set(next, remaining);
      if (remaining === 0) {
        queue.push(next);
      }
    }
  }
  if (ordered.length !== keys.length) {
    throw new CyclicMigrationDependencyError();
  }
  return ordered;
}
