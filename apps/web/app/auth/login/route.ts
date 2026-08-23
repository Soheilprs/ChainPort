import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { formString } from "@/lib/server-api";

function safeReturnTo(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/app/projects";
  }
  return value;
}

export async function POST(request: Request): Promise<NextResponse> {
  const formData = await request.formData();
  const email = formString(formData, "email").trim();
  const returnTo = safeReturnTo(formString(formData, "returnTo", "/app/projects"));
  const fail = (error: string) =>
    NextResponse.redirect(
      new URL(`/auth/sign-in?error=${error}&returnTo=${encodeURIComponent(returnTo)}`, request.url),
      303,
    );

  if (email === "" || !email.includes("@")) {
    return fail("invalid-email");
  }

  let apiResponse: Response;
  try {
    apiResponse = await fetch(`${API_URL}/v1/auth/test/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name: email.split("@")[0] }),
    });
  } catch {
    return fail("api-unavailable");
  }

  if (apiResponse.status === 404) {
    return fail("oidc-required");
  }
  if (!apiResponse.ok) {
    return fail("failed");
  }

  const payload = (await apiResponse.json()) as {
    data?: { sessionToken?: string; csrfToken?: string };
  };
  const sessionToken = payload.data?.sessionToken;
  const csrfToken = payload.data?.csrfToken;
  if (typeof sessionToken !== "string" || sessionToken === "") {
    return fail("failed");
  }

  const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
  response.cookies.set({
    name: "chainport_session",
    value: sessionToken,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 43_200,
  });
  if (typeof csrfToken === "string" && csrfToken !== "") {
    response.cookies.set({
      name: "chainport_csrf",
      value: csrfToken,
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 43_200,
    });
  }
  return response;
}
