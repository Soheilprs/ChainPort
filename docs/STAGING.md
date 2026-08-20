# Staging environment

This is **not** a product feature phase. Feature development ended at Phase 11.

External staging has not been provisioned from this repository. Completing this document plus
production-mode fail-closed checks is **staging configuration readiness**, not a live staging
environment.

Label for Docker Compose in this repo: **LOCAL_PRODUCTION_SIMULATION**. It does not count as
staging.

## Verdict target

`NODE_ENV=production` with `CHAINPORT_DB_PURPOSE=staging` exercises the same production safety
assertions as production. There is no weakened staging mode.

## Topology

```
Internet
  ↓
HTTPS reverse proxy / load balancer  (TLS termination)
  ↓
  /            → web :3000   (non-root)
  /backend/    → api :3001   (strip /backend, non-root)
       ↓
  private network
       ├── PostgreSQL   (not published)
       ├── Redis        (not published)
       └── Object store (S3-compatible; gate pending)
       ↓
  worker  (private; Docker daemon access for sandboxes only)
       ↓
  sandbox containers  (no Docker socket, no DB/Redis, no metadata)
       ↓
  RPC proxy container (allowlisted methods)
       ↓
  OP Sepolia  (when ENABLE_TESTNET_DEPLOYMENT=true)
```

Public ingress is HTTPS only. Do not expose PostgreSQL, Redis, the Docker socket, sandbox
networks, or the RPC proxy to the internet.

Prefer **same-origin** web/API:

- `WEB_ORIGIN=https://<staging-host>`
- `NEXT_PUBLIC_API_URL=/backend`
- reverse proxy forwards `/backend/` to the API and sets `X-Forwarded-Proto` / `X-Forwarded-For`
- `OIDC_REDIRECT_URI=https://<staging-host>/backend/v1/auth/oidc/callback`

Do not hardcode a product domain. Configure `WEB_ORIGIN` per environment.

If web and API are split across origins, CORS is the configured `WEB_ORIGIN` with credentials.
There is no wildcard authenticated CORS. Production cookies are `Secure` + `SameSite=None`.

## Isolation from production

Staging must have its own:

- PostgreSQL catalog
- Redis instance
- artifact bucket
- `SESSION_SECRET`
- OIDC client
- GitHub App (when private repos are enabled)
- testnet funder wallet
- Etherscan key
- public origin

Never share those with a future production environment.

## Images

Tag by Git SHA, not `latest` alone:

```
chainport-api:<git-sha>
chainport-worker:<git-sha>
chainport-web:<git-sha>
chainport/sandbox-foundry:1
chainport/sandbox-node20:1
chainport/sandbox-node22:1
chainport/rpc-proxy:1
```

Build:

```bash
SHA="$(git rev-parse HEAD)"
docker build --build-arg GIT_SHA="$SHA" -t "chainport-api:$SHA" -f infrastructure/docker/api/Dockerfile .
docker build --build-arg GIT_SHA="$SHA" -t "chainport-worker:$SHA" -f infrastructure/docker/worker/Dockerfile .
docker build --build-arg GIT_SHA="$SHA" -t "chainport-web:$SHA" -f infrastructure/docker/web/Dockerfile .
pnpm sandbox:build
```

Record image digests (`docker image inspect --format '{{.RepoDigests}} {{.Id}}'`) with the Git SHA.

Frozen lockfile: Dockerfiles run `pnpm install --frozen-lockfile`.

## Worker / sandbox trust boundary

```
Trusted worker process
  → Docker daemon (worker may use the host socket / DOCKER_HOST)
    → Untrusted sandbox  (no socket, non-root 10001, cap-drop ALL, read-only root)
```

Repository code must never see `/var/run/docker.sock`. The runner refuses privileged sandboxes and
destroys a container if inspect shows `docker.sock`.

The worker image includes `docker-cli` so it can create sandboxes. Run it on a Docker host:

```
--group-add <host-docker-gid>
-v /var/run/docker.sock:/var/run/docker.sock
```

Do not mount the socket into sandbox or RPC-proxy containers. Do not publish sandbox networks.

## Artifact storage

Production/staging boot requires `ARTIFACT_STORE=s3` plus `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and
`S3_SECRET_ACCESS_KEY`. Optional: `S3_ENDPOINT`, `S3_REGION` (required for R2-style endpoints).

The live S3-compatible HTTP transport is **not** wired. The worker still uses
`FileSystemArtifactStore`. Status: **OBJECT_STORAGE_GATE_PENDING**. Do not treat filesystem disks
as durable staging storage.

`/ready` checks PostgreSQL and Redis. Object-store liveness waits for the object-storage gate.

## Kill switches (first bring-up)

| Flag                        | First staging value           | Later              |
| --------------------------- | ----------------------------- | ------------------ |
| `ENABLE_VALIDATION`         | `true`                        | keep               |
| `ENABLE_TESTNET_DEPLOYMENT` | `false` until smoke + OIDC    | OP Sepolia only    |
| `ENABLE_PRIVATE_REPOS`      | `false` until GitHub App gate | one private repo   |
| Mainnet                     | **no flag exists**            | remains impossible |

## Startup order

1. Provider backup/PITR enabled on the staging catalog
2. `pnpm db:deploy` (Prisma `migrate deploy` only — never `migrate reset` / `db push`)
3. Start API
4. Start worker (sandbox host)
5. Start web
6. `GET /ready` 200
7. Worker logs “Worker started”
8. Smoke tests below

`GET /health` is process liveness (no dependencies, no secrets). `GET /ready` is 503 when
PostgreSQL or Redis is down and does not leak connection strings.

## Deploy procedure

1. Snapshot/backup the staging catalog
2. Build and push SHA-tagged images; record digests
3. Run `pnpm db:deploy` against staging `DATABASE_URL`
4. Roll API to the new SHA
5. Roll worker
6. Roll web (`NEXT_PUBLIC_API_URL` is baked at image build; rebuild web when the public API path changes)
7. Confirm `/health`, `/ready`, `/metrics`
8. Confirm worker heartbeat/logs
9. Run the smoke list

## Rollback

- Application: previous SHA-tagged images.
- Database: prefer forward-compatible migrations and a forward fix. Prisma schema rollback is not
  claimed safe. Severe cases: restore snapshot / PITR to a throwaway instance first.

## Smoke test

| Step                                                  | Gate                                         |
| ----------------------------------------------------- | -------------------------------------------- |
| Load partner landing `GET /v1/public/partners/:slug`  | this gate (public)                           |
| `GET /health` / `GET /ready` / `GET /metrics`         | this gate                                    |
| Authenticate                                          | **OIDC gate**                                |
| Create `INTERNAL_TEST` public-repo project            | after OIDC                                   |
| Ingest → analysis → compatibility → plan → validation | after OIDC                                   |
| Optional OP Sepolia deploy                            | after OIDC + enable testnet + staging funder |

Unauthenticated mutating APIs remain 401. That is expected until OIDC is configured.

## Local production simulation

`infrastructure/docker-compose.production-sim.yml` and `scripts/local-production-sim.sh` build
production images and prove fail-closed production safety. They are **not** staging.

## Remaining external gates

1. Real OIDC
2. GitHub App + one private repository
3. Durable S3/R2 artifact storage
