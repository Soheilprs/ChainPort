import { ApiRequestError } from "../errors.js";
import type { AuthService } from "../auth-service.js";
import type { ApiInstance } from "../types.js";

export function registerAuthRoutes(app: ApiInstance, auth: AuthService): void {
  const names = auth.cookieNames();

  app.post("/v1/auth/test/login", async (request, reply) => {
    const result = await auth.loginWithTestIdentity(request.body, {
      ip: request.ip,
      ...(typeof request.headers["user-agent"] === "string"
        ? { userAgent: request.headers["user-agent"] }
        : {}),
    });
    reply.setCookie(names.session, result.sessionToken, auth.cookieOptions());
    reply.setCookie(names.csrf, result.csrfToken, auth.csrfCookieOptions());
    return reply.send({
      data: {
        user: presentUser(result.user),
        csrfToken: result.csrfToken,
        expiresAt: result.expiresAt.toISOString(),
        sessionToken: result.sessionToken,
      },
    });
  });

  app.get("/v1/auth/oidc/start", async (request, reply) => {
    const query = request.query as { returnTo?: string };
    const started = auth.startOidc(query.returnTo ?? "/app/projects");
    reply.setCookie("chainport_oidc_nonce", started.nonce, {
      ...auth.cookieOptions(),
      maxAge: 600,
    });
    reply.setCookie("chainport_oidc_state", started.state, {
      ...auth.cookieOptions(),
      maxAge: 600,
    });
    return reply.redirect(started.url);
  });

  app.get("/v1/auth/oidc/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    if (typeof query.error === "string" && query.error !== "") {
      throw new ApiRequestError(401, "OIDC_REJECTED", "Identity provider rejected the request");
    }
    const code = query.code;
    const state = query.state;
    const cookieState = request.cookies.chainport_oidc_state;
    const nonce = request.cookies.chainport_oidc_nonce;
    if (
      typeof code !== "string" ||
      code === "" ||
      typeof state !== "string" ||
      state === "" ||
      typeof cookieState !== "string" ||
      typeof nonce !== "string" ||
      cookieState !== state
    ) {
      throw new ApiRequestError(401, "OIDC_REJECTED", "OIDC state is invalid");
    }
    const parsed = auth.parseOidcState(state);
    const result = await auth.completeOidc({
      code,
      nonce,
      redirectUri: auth.oidcRedirectUri(),
      request: {
        ip: request.ip,
        ...(typeof request.headers["user-agent"] === "string"
          ? { userAgent: request.headers["user-agent"] }
          : {}),
      },
    });
    reply.clearCookie("chainport_oidc_nonce", { path: "/" });
    reply.clearCookie("chainport_oidc_state", { path: "/" });
    reply.setCookie(names.session, result.sessionToken, auth.cookieOptions());
    reply.setCookie(names.csrf, result.csrfToken, auth.csrfCookieOptions());
    return reply.redirect(auth.postLoginRedirect(parsed.returnTo));
  });

  app.get("/v1/auth/me", (request) => {
    if (request.actor === undefined) {
      return { data: { user: null } };
    }
    return { data: { user: presentActor(request.actor) } };
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    const token = readToken(request);
    await auth.logout(token);
    reply.clearCookie(names.session, { path: "/" });
    reply.clearCookie(names.csrf, { path: "/" });
    return { data: { ok: true } };
  });
}

function presentUser(
  user: { id: string; email: string; name: string | null; isPlatformAdmin?: boolean } | undefined,
) {
  if (user === undefined) {
    return null;
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isPlatformAdmin: user.isPlatformAdmin === true,
  };
}

function presentActor(actor: {
  userId: string;
  email: string;
  name: string | null;
  isPlatformAdmin: boolean;
}) {
  return {
    id: actor.userId,
    email: actor.email,
    name: actor.name,
    isPlatformAdmin: actor.isPlatformAdmin,
  };
}

function readToken(request: {
  cookies?: Record<string, string | undefined>;
  headers: { authorization?: string | undefined };
}): string | undefined {
  const bearer = request.headers.authorization;
  if (typeof bearer === "string" && bearer.startsWith("Bearer ")) {
    return bearer.slice(7);
  }
  return request.cookies?.chainport_session;
}
