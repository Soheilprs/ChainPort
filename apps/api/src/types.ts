import type { IncomingMessage, Server, ServerResponse } from "node:http";

import type { FastifyInstance } from "fastify";
import type { Logger } from "pino";

export type ApiInstance = FastifyInstance<
  Server<typeof IncomingMessage, typeof ServerResponse>,
  IncomingMessage,
  ServerResponse<IncomingMessage>,
  Logger
>;
