# Observability

- Structured pino logs with `requestId` (`x-request-id`)
- Secrets redacted (`authorization`, cookies, private keys, funder key)
- `GET /metrics` Prometheus text (request counters, duration sum/count, workers seen)
- `GET /health` liveness (no dependencies)
- `GET /ready` PostgreSQL + Redis (503, no secrets). Object-store probe waits for OBJECT_STORAGE_GATE_PENDING
- Worker heartbeats can be published later via Redis; queue lag is inspected through BullMQ
- Optional `revision` on `/health` when `CHAINPORT_GIT_SHA` is set

Scrape `/metrics` for API request counters, latency sum/count, and workers seen. Job failures,
validation/sandbox/deployment outcomes, and RPC-proxy errors are structured logs (`job failed`,
sandbox policy, `errorCode` on persisted runs). Do not stand up a separate observability product
for the pilot.

Never log session tokens, GitHub installation tokens, or source.
