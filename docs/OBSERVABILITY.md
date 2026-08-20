# Observability

- Structured pino logs with `requestId` (`x-request-id`)
- Secrets redacted (`authorization`, cookies, private keys, funder key)
- `GET /metrics` Prometheus text (request counters, duration sum/count, workers seen)
- `GET /health` liveness (no dependencies)
- `GET /ready` PostgreSQL + Redis
- Worker heartbeats can be published later via Redis; queue lag is inspected through BullMQ

Never log session tokens, GitHub installation tokens, or source.
