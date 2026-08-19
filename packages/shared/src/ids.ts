import { DomainValidationError } from "./errors.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createId(): string {
  return globalThis.crypto.randomUUID();
}

export function isId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function assertId(value: string, field: string): void {
  if (!isId(value)) {
    throw new DomainValidationError(`${field} must be a UUID`);
  }
}

export function parseId(value: unknown, field: string): string {
  if (!isId(value)) {
    throw new DomainValidationError(`${field} must be a UUID`);
  }
  return value;
}
