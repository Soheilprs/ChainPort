# GitHub App

Private repositories use a GitHub App, not long-lived PATs.

Permissions (read only):

- Contents: Read
- Metadata: Read

Installation tokens are minted server-side, short-lived, never persisted, never returned in APIs, never written into clone URLs, and redacted from logs. Clone uses `git -c http.extraHeader=Authorization: Bearer <token>`.

Persisted: installation id only (`github_installations`).

If the installation is removed, rematerialization fails with `GITHUB_ACCESS_REVOKED`. Historical analyses remain.

Public HTTPS clone without credentials remains available.

`ENABLE_PRIVATE_REPOS=false` disables the private path. Production requires App id + private key when private repos are enabled.
