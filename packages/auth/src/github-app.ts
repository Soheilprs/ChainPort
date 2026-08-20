import { createPrivateKey, createSign } from "node:crypto";

export interface GitHubInstallationToken {
  token: string;
  expiresAt: Date;
  installationId: string;
}

export interface GitHubAppClient {
  createInstallationToken(installationId: string): Promise<GitHubInstallationToken>;
}

export interface GitHubAppConfig {
  appId: string;
  privateKeyPem: string;
  apiBaseUrl?: string;
}

export class HttpGitHubAppClient implements GitHubAppClient {
  public constructor(private readonly config: GitHubAppConfig) {}

  public async createInstallationToken(installationId: string): Promise<GitHubInstallationToken> {
    const jwt = signGitHubAppJwt(this.config.appId, this.config.privateKeyPem);
    const base = this.config.apiBaseUrl ?? "https://api.github.com";
    const response = await fetch(`${base}/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "User-Agent": "ChainPort",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (response.status === 401 || response.status === 404) {
      throw new Error("GITHUB_ACCESS_REVOKED");
    }
    if (!response.ok) {
      throw new Error("GITHUB_APP_TOKEN_FAILED");
    }
    const body = (await response.json()) as { token?: string; expires_at?: string };
    if (typeof body.token !== "string") {
      throw new Error("GITHUB_APP_TOKEN_FAILED");
    }
    return {
      token: body.token,
      expiresAt:
        body.expires_at === undefined
          ? new Date(Date.now() + 50 * 60_000)
          : new Date(body.expires_at),
      installationId,
    };
  }
}

export class StaticGitHubAppClient implements GitHubAppClient {
  public constructor(private readonly token: string) {}

  public createInstallationToken(installationId: string): Promise<GitHubInstallationToken> {
    return Promise.resolve({
      token: this.token,
      expiresAt: new Date(Date.now() + 50 * 60_000),
      installationId,
    });
  }
}

export function signGitHubAppJwt(appId: string, privateKeyPem: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iat: now - 30, exp: now + 540, iss: appId }),
  ).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(createPrivateKey(privateKeyPem), "base64url");
  return `${header}.${payload}.${signature}`;
}

export function authorizationHeaderFromInstallationToken(token: string): string {
  return `Bearer ${token}`;
}
