import {
  hashToken,
  randomToken,
  TestIdentityProvider,
  OidcIdentityProvider,
  tokensEqual,
  type Actor,
  type IdentityProvider,
} from "@chainport/auth";
import type { IdentityRepository } from "@chainport/db";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SESSION_COOKIE_NAME,
  TEST_IDENTITY_ISSUER,
  type MembershipRole,
  type OrganizationKind,
  type ServiceConfig,
} from "@chainport/shared";

import { ApiRequestError } from "./errors.js";

export interface AuthCookies {
  session: string;
  csrf: string;
}

export class AuthService {
  public readonly provider: IdentityProvider;

  public constructor(
    private readonly identities: IdentityRepository,
    private readonly config: ServiceConfig,
  ) {
    this.provider = createProvider(config);
  }

  public cookieOptions(): {
    path: string;
    httpOnly: true;
    secure: boolean;
    sameSite: "none" | "lax";
    maxAge: number;
  } {
    const secure = this.config.NODE_ENV === "production";
    return {
      path: "/",
      httpOnly: true,
      secure,
      sameSite: secure ? "none" : "lax",
      maxAge: this.config.SESSION_TTL_SECONDS,
    };
  }

  public csrfCookieOptions(): {
    path: string;
    httpOnly: false;
    secure: boolean;
    sameSite: "none" | "lax";
    maxAge: number;
  } {
    return { ...this.cookieOptions(), httpOnly: false };
  }

  public async loginWithTestIdentity(body: unknown, request: { ip?: string; userAgent?: string }) {
    if (this.config.AUTH_PROVIDER !== "test") {
      throw new ApiRequestError(404, "ROUTE_NOT_FOUND", "Route not found");
    }
    const input = asRecord(body);
    const email = asEmail(input.email);
    const name = typeof input.name === "string" ? input.name : (email.split("@")[0] ?? "user");
    const user = await this.identities.upsertOidcUser({
      email,
      name,
      issuer: TEST_IDENTITY_ISSUER,
      subject: email,
    });
    if (input.isPlatformAdmin === true) {
      await this.identities.setPlatformAdmin(user.id, true);
    }
    if (input.organization !== undefined && typeof input.organization === "object") {
      const orgInput = input.organization as Record<string, unknown>;
      const org = await this.identities.createOrganization({
        name: asString(orgInput.name, "organization.name"),
        slug: asString(orgInput.slug, "organization.slug"),
        kind: asKind(orgInput.kind),
      });
      await this.identities.addMembership({
        userId: user.id,
        organizationId: org.id,
        role: asRole(orgInput.role),
      });
    }
    const latest = (await this.identities.getUserById(user.id)) ?? user;
    return this.issueSession(latest.id, request);
  }

  public startOidc(returnTo: string): { url: string; state: string; nonce: string } {
    const state = randomToken(16);
    const nonce = randomToken(16);
    const redirectUri = this.config.OIDC_REDIRECT_URI ?? `${this.config.WEB_ORIGIN}/auth/callback`;
    return {
      url: this.provider.authorizationUrl({ state, nonce, redirectUri }),
      state: `${state}.${Buffer.from(returnTo).toString("base64url")}`,
      nonce,
    };
  }

  public async completeOidc(input: {
    code: string;
    nonce: string;
    redirectUri: string;
    request: { ip?: string; userAgent?: string };
  }) {
    const claims = await this.provider.complete({
      code: input.code,
      nonce: input.nonce,
      redirectUri: input.redirectUri,
    });
    const user = await this.identities.upsertOidcUser(claims);
    return this.issueSession(user.id, input.request);
  }

  public async actorFromToken(token: string | undefined): Promise<Actor | undefined> {
    if (token === undefined || token === "") {
      return undefined;
    }
    const session = await this.identities.getSessionByTokenHash(hashToken(token));
    if (
      session === undefined ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() < Date.now()
    ) {
      return undefined;
    }
    const user = await this.identities.getUserById(session.userId);
    if (user === undefined) {
      return undefined;
    }
    const memberships = await this.identities.listMemberships(user.id);
    await this.identities.touchSession(session.id);
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      isPlatformAdmin: user.isPlatformAdmin,
      memberships,
    };
  }

  public async requireActor(token: string | undefined): Promise<Actor> {
    const actor = await this.actorFromToken(token);
    if (actor === undefined) {
      throw new ApiRequestError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
    }
    return actor;
  }

  public async verifyCsrf(token: string | undefined, header: string | undefined): Promise<void> {
    if (token === undefined) {
      return;
    }
    const session = await this.identities.getSessionByTokenHash(hashToken(token));
    if (session === undefined) {
      throw new ApiRequestError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
    }
    if (header === undefined || !tokensEqual(hashToken(header), session.csrfHash)) {
      throw new ApiRequestError(403, "CSRF_REJECTED", "CSRF token is invalid");
    }
  }

  public async logout(token: string | undefined): Promise<void> {
    if (token === undefined) {
      return;
    }
    const session = await this.identities.getSessionByTokenHash(hashToken(token));
    if (session !== undefined) {
      await this.identities.revokeSession(session.id);
      await this.identities.recordAudit({
        actorUserId: session.userId,
        action: "LOGOUT",
        targetType: "Session",
        targetId: session.id,
      });
    }
  }

  public async issueSession(userId: string, request: { ip?: string; userAgent?: string }) {
    const sessionToken = randomToken();
    const csrfToken = randomToken();
    const expiresAt = new Date(Date.now() + this.config.SESSION_TTL_SECONDS * 1000);
    const session = await this.identities.createSession({
      userId,
      tokenHash: hashToken(sessionToken),
      csrfHash: hashToken(csrfToken),
      expiresAt,
      ...(request.ip === undefined ? {} : { ip: request.ip }),
      ...(request.userAgent === undefined ? {} : { userAgent: request.userAgent }),
    });
    await this.identities.recordAudit({
      actorUserId: userId,
      action: "LOGIN",
      targetType: "Session",
      targetId: session.id,
    });
    const user = await this.identities.getUserById(userId);
    return { sessionToken, csrfToken, expiresAt, user };
  }

  public cookieNames() {
    return { session: SESSION_COOKIE_NAME, csrf: CSRF_COOKIE_NAME, header: CSRF_HEADER_NAME };
  }
}

function createProvider(config: ServiceConfig): IdentityProvider {
  if (config.AUTH_PROVIDER === "oidc") {
    if (
      config.OIDC_ISSUER === undefined ||
      config.OIDC_CLIENT_ID === undefined ||
      config.OIDC_CLIENT_SECRET === undefined
    ) {
      throw new ApiRequestError(500, "AUTH_NOT_CONFIGURED", "OIDC is not configured");
    }
    return new OidcIdentityProvider({
      issuer: config.OIDC_ISSUER,
      clientId: config.OIDC_CLIENT_ID,
      clientSecret: config.OIDC_CLIENT_SECRET,
      redirectUri: config.OIDC_REDIRECT_URI ?? `${config.WEB_ORIGIN}/auth/callback`,
    });
  }
  return new TestIdentityProvider();
}

function asRecord(body: unknown): Record<string, unknown> {
  if (body === undefined || body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiRequestError(400, "INVALID_REQUEST", "Request body is invalid");
  }
  return body as Record<string, unknown>;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiRequestError(400, "INVALID_REQUEST", `${field} is required`);
  }
  return value.trim();
}

function asEmail(value: unknown): string {
  const email = asString(value, "email").toLowerCase();
  if (!email.includes("@") || email.length > 254) {
    throw new ApiRequestError(400, "INVALID_REQUEST", "email is invalid");
  }
  return email;
}

function asKind(value: unknown): OrganizationKind {
  if (
    value === "NETWORK" ||
    value === "FOUNDATION" ||
    value === "ECOSYSTEM" ||
    value === "RAAS" ||
    value === "INTERNAL"
  ) {
    return value;
  }
  return "NETWORK";
}

function asRole(value: unknown): MembershipRole {
  if (value === "OWNER" || value === "ADMIN" || value === "MEMBER" || value === "VIEWER") {
    return value;
  }
  return "MEMBER";
}
