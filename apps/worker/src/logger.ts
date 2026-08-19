import type { ServiceName } from "@chainport/shared";
import pino, { type DestinationStream, type Logger } from "pino";

export interface CreateLoggerOptions {
  service: ServiceName;
  level: string;
  destination?: DestinationStream;
}

const redact = {
  paths: [
    "DATABASE_URL",
    "REDIS_URL",
    "password",
    "secret",
    "privateKey",
    "*.password",
    "*.secret",
  ],
  censor: "[redacted]",
};

export function createLogger(options: CreateLoggerOptions): Logger {
  const pinoOptions = {
    level: options.level,
    base: { service: options.service },
    redact,
  };

  return options.destination === undefined
    ? pino(pinoOptions)
    : pino(pinoOptions, options.destination);
}
