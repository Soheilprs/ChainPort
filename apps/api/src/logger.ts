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
    "authorization",
    "req.headers.authorization",
    "req.headers.cookie",
    "sessionToken",
    "csrfToken",
    "token",
    "CHAINPORT_TESTNET_FUNDER_PRIVATE_KEY",
    "GITHUB_APP_PRIVATE_KEY",
    "OIDC_CLIENT_SECRET",
    "SESSION_SECRET",
    "*.DATABASE_URL",
    "*.REDIS_URL",
    "*.password",
    "*.secret",
    "*.privateKey",
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
