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

## Staging app settings (next gate)

Keep `ENABLE_PRIVATE_REPOS=false` until this gate. Then create a **staging-only** GitHub App:

| Field               | Value                                              |
| ------------------- | -------------------------------------------------- |
| Homepage URL        | `https://<staging-web-host>`                       |
| Setup / install URL | `https://<staging-web-host>/app/projects`          |
| User identification | OIDC, not GitHub OAuth                             |
| Webhook             | optional until installation lifecycle is exercised |
| Permissions         | Contents: Read, Metadata: Read                     |

Environment (secret manager): `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, optional
`GITHUB_APP_CLIENT_ID` / `GITHUB_APP_CLIENT_SECRET`. `GITHUB_API_BASE_URL` stays
`https://api.github.com`.

Do not reuse a production App installation on staging.
