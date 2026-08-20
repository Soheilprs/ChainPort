# Sandbox security

Threat: a malicious public GitHub repository attempting to compromise the ChainPort host, database, Redis, credentials, or other tenants.

Trust boundary: repository code becomes executable **only** inside a hardened ephemeral container. Phases 3–6 remain non-executing parsers.

## Container controls

- non-root `10001:10001`
- no `--privileged`
- no Docker socket
- `--cap-drop ALL`
- `--security-opt no-new-privileges`
- `--read-only` root
- writable: bind-mounted `/workspace` and tmpfs `/tmp`
- `--network none` for build/test
- install uses a dedicated bridge, then disconnects
- memory / CPU / PID limits
- `timeout --signal=KILL` around commands
- `docker rm -f` after every run
- labels `chainport.validation=1` for orphan reap
- environment allowlist only (`CI`, `HOME=/tmp/home`, `PATH`, `SVM_HOME`, …)
- no inherited `process.env`
- `host.docker.internal` and metadata hosts mapped to `127.0.0.1`
- deployment runs attach only to an isolated proxy network; they do not receive general internet
- `PRIVATE_KEY` is allowlisted only for the deployment sandbox (disposable testnet EOA, never the funder)

## Network limitation

v1 cannot enforce destination allowlists (npm/GitHub/Foundry) without host iptables or a filtering proxy. Install therefore uses an isolated user-defined bridge rather than the host network. Build and test run with `--network none`. Do not treat install-stage egress as a registry allowlist.

Docker Desktop on macOS may still allow containers to reach host-published ports during the install stage. PostgreSQL/Redis credentials are never passed into the sandbox.

## Install scripts

npm/pnpm/yarn run with `--ignore-scripts`. If compile then fails and the repository declares lifecycle scripts, the result is `INSTALL_SCRIPTS_REQUIRED`, not a script enablement.

## Images

Curated local images:

- `chainport/sandbox-foundry:1`
- `chainport/sandbox-node22:1`
- `chainport/sandbox-node20:1`

Digests are recorded on each ValidationRun via `docker image inspect`. Rebuild images with `pnpm sandbox:build`.
