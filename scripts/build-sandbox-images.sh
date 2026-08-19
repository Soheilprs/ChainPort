#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
docker build -t chainport/sandbox-foundry:1 -f "$root/infrastructure/docker/sandbox/Dockerfile.foundry" "$root/infrastructure/docker/sandbox"
docker build -t chainport/sandbox-node22:1 -f "$root/infrastructure/docker/sandbox/Dockerfile.node22" "$root/infrastructure/docker/sandbox"
docker build -t chainport/sandbox-node20:1 -f "$root/infrastructure/docker/sandbox/Dockerfile.node20" "$root/infrastructure/docker/sandbox"
echo "sandbox images built"
docker image inspect --format '{{.RepoTags}} {{.Id}}' chainport/sandbox-foundry:1 chainport/sandbox-node22:1 chainport/sandbox-node20:1
