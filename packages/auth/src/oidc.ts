import { createRemoteJWKSet, jwtVerify } from "jose";

import { TEST_IDENTITY_ISSUER } from "@chainport/shared";

export interface IdentityClaims {
  issuer: string;
  subject: string;
  email: string;
  name: string | null;
}

export interface IdentityProvider {
  readonly name: "test" | "oidc";
  authorizationUrl(input: { state: string; nonce: string; redirectUri: string }): string;
  complete(input: { code: string; nonce: string; redirectUri: string }): Promise<IdentityClaims>;
}

export class TestIdentityProvider implements IdentityProvider {
  public readonly name = "test" as const;

  public authorizationUrl(input: { state: string; nonce: string; redirectUri: string }): string {
    const url = new URL(input.redirectUri);
    url.searchParams.set("code", `test:${input.nonce}`);
    url.searchParams.set("state", input.state);
    return url.toString();
  }

  public complete(input: { code: string; nonce: string }): Promise<IdentityClaims> {
    if (input.code !== `test:${input.nonce}` && !input.code.startsWith("test:")) {
      return Promise.reject(new Error("invalid test identity code"));
    }
    const email = input.code.startsWith("test:email:")
      ? input.code.slice("test:email:".length)
      : "developer@chainport.test";
    return Promise.resolve({
      issuer: TEST_IDENTITY_ISSUER,
      subject: email,
      email,
      name: email.split("@")[0] ?? "developer",
    });
  }
}

export interface OidcProviderConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class OidcIdentityProvider implements IdentityProvider {
  public readonly name = "oidc" as const;
  private jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

  public constructor(private readonly config: OidcProviderConfig) {}

  public authorizationUrl(input: { state: string; nonce: string; redirectUri: string }): string {
    const url = new URL(`${this.config.issuer.replace(/\/$/, "")}/authorize`);
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", input.state);
    url.searchParams.set("nonce", input.nonce);
    return url.toString();
  }

  public async complete(input: {
    code: string;
    nonce: string;
    redirectUri: string;
  }): Promise<IdentityClaims> {
    const tokenUrl = `${this.config.issuer.replace(/\/$/, "")}/token`;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
    if (!response.ok) {
      throw new Error("OIDC token exchange failed");
    }
    const payload = (await response.json()) as { id_token?: string };
    if (typeof payload.id_token !== "string") {
      throw new Error("OIDC id_token missing");
    }
    this.jwks ??= createRemoteJWKSet(
      new URL(`${this.config.issuer.replace(/\/$/, "")}/.well-known/jwks.json`),
    );
    const verified = await jwtVerify(payload.id_token, this.jwks, {
      issuer: this.config.issuer,
      audience: this.config.clientId,
    });
    const nonce = verified.payload.nonce;
    if (nonce !== input.nonce) {
      throw new Error("OIDC nonce mismatch");
    }
    const email = verified.payload.email;
    const subject = verified.payload.sub;
    if (typeof email !== "string" || typeof subject !== "string") {
      throw new Error("OIDC identity incomplete");
    }
    return {
      issuer: this.config.issuer,
      subject,
      email,
      name: typeof verified.payload.name === "string" ? verified.payload.name : null,
    };
  }
}
