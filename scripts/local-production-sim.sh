#!/usr/bin/env bash
# LOCAL_PRODUCTION_SIMULATION — not real staging.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
SHA="$(git rev-parse HEAD)"
echo "git_sha=$SHA"

fail_closed() {
  local name="$1"
  shift
  echo "=== fail-closed: $name ==="
  set +e
  output="$(docker run --rm --network none "$@" "chainport-api:$SHA" 2>&1)"
  code=$?
  set -e
  echo "$output" | tail -n 20
  if [[ "$code" -eq 0 ]]; then
    echo "expected fail-closed for $name, but the container exited 0" >&2
    exit 1
  fi
  echo "$output" | grep -q "Invalid ChainPort configuration"
}

if [[ "${SKIP_BUILD:-}" == "1" ]]; then
  echo "=== skip image build ==="
else
  echo "=== build production images ==="
  docker build --build-arg GIT_SHA="$SHA" -t "chainport-api:$SHA" -f infrastructure/docker/api/Dockerfile .
  docker build --build-arg GIT_SHA="$SHA" -t "chainport-worker:$SHA" -f infrastructure/docker/worker/Dockerfile .
  docker build --build-arg GIT_SHA="$SHA" -t "chainport-web:$SHA" -f infrastructure/docker/web/Dockerfile .
fi
docker image inspect --format '{{.RepoTags}} {{.Id}}' "chainport-api:$SHA" "chainport-worker:$SHA" "chainport-web:$SHA"

common_env=(
  -e NODE_ENV=production
  -e CHAINPORT_DB_PURPOSE=staging
  -e DATABASE_URL=postgresql://pilot:s3cret-long@db.internal/chainport
  -e REDIS_URL=rediss://redis.internal:6379
  -e WEB_ORIGIN=https://staging.example
  -e AUTH_PROVIDER=oidc
  -e SESSION_SECRET=abcdefghijklmnopqrstuvwxyz012345
  -e OIDC_ISSUER=https://idp.example
  -e OIDC_CLIENT_ID=client
  -e OIDC_CLIENT_SECRET=oidc-secret
  -e OIDC_REDIRECT_URI=https://staging.example/backend/v1/auth/oidc/callback
  -e ARTIFACT_STORE=s3
  -e S3_BUCKET=chainport-artifacts
  -e S3_ACCESS_KEY_ID=AKIA
  -e S3_SECRET_ACCESS_KEY=secret-key
  -e ENABLE_PRIVATE_REPOS=false
  -e ENABLE_TESTNET_DEPLOYMENT=false
)

fail_closed "AUTH_PROVIDER=test" "${common_env[@]}" -e AUTH_PROVIDER=test
fail_closed "ARTIFACT_STORE=filesystem" "${common_env[@]}" -e ARTIFACT_STORE=filesystem
fail_closed "localhost DATABASE_URL" "${common_env[@]}" \
  -e DATABASE_URL=postgresql://pilot:s3cret-long@localhost:5433/chainport
fail_closed "localhost REDIS_URL" "${common_env[@]}" \
  -e REDIS_URL=redis://localhost:6379
fail_closed "CHAINPORT_DB_PURPOSE=development" "${common_env[@]}" \
  -e CHAINPORT_DB_PURPOSE=development

echo "=== production image health with local dependencies (NODE_ENV=development; not staging) ==="
cid="$(docker run -d --rm \
  --add-host=host.docker.internal:host-gateway \
  -e NODE_ENV=development \
  -e CHAINPORT_DB_PURPOSE=development \
  -e DATABASE_URL=postgresql://chainport:chainport@host.docker.internal:5433/chainport \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e WEB_ORIGIN=http://localhost:3000 \
  -e AUTH_PROVIDER=test \
  -e ARTIFACT_STORE=filesystem \
  -e ENABLE_PRIVATE_REPOS=false \
  -p 13001:3001 \
  "chainport-api:$SHA")"
cleanup() { docker rm -f "$cid" >/dev/null 2>&1 || true; }
trap cleanup EXIT
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:13001/health" >/dev/null; then
    break
  fi
  sleep 1
done
curl -fsS "http://127.0.0.1:13001/health"
echo
curl -fsS "http://127.0.0.1:13001/ready"
echo
curl -fsS "http://127.0.0.1:13001/metrics" | head -n 5
echo
echo "=== graceful shutdown ==="
docker kill -s SIGTERM "$cid"
sleep 2
if docker ps -q --filter "id=$cid" | grep -q .; then
  echo "container still running after SIGTERM" >&2
  exit 1
fi
trap - EXIT
echo "LOCAL_PRODUCTION_SIMULATION complete sha=$SHA"
