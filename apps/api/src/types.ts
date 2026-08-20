import type { IncomingMessage, Server, ServerResponse } from "node:http";

import type { Actor } from "@chainport/auth";
import type { FastifyInstance } from "fastify";
import type { Logger } from "pino";

declare module "fastify" {
  interface FastifyRequest {
    actor?: Actor | undefined;
    requestId: string;
  }
}

export type ApiInstance = FastifyInstance<
  Server<typeof IncomingMessage, typeof ServerResponse>,
  IncomingMessage,
  ServerResponse<IncomingMessage>,
  Logger
>;
