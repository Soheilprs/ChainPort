import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { csrfFromCookieHeader, formString } from "@/lib/server-api";

function safeReturnTo(value: string, fallback: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const formData = await request.formData().catch(() => null);
  const fallback = `/app/projects/${id}`;
  const returnTo = safeReturnTo(formString(formData, "returnTo", fallback), fallback);
  const analysisId = formString(formData, "analysisId");
  const fail = (error: string) =>
    NextResponse.redirect(
      new URL(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${error}`, request.url),
      303,
    );

  const cookie = request.headers.get("cookie") ?? "";
  if (cookie === "") {
    return NextResponse.redirect(
      new URL(`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`, request.url),
      303,
    );
  }

  const csrf = csrfFromCookieHeader(cookie);
  let apiResponse: Response;
  try {
    apiResponse = await fetch(`${API_URL}/v1/projects/${id}/compatibility-runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        ...(csrf === undefined ? {} : { "x-csrf-token": csrf }),
      },
      body: JSON.stringify(analysisId === "" ? {} : { analysisId }),
    });
  } catch {
    return fail("api-unavailable");
  }

  if (apiResponse.status === 401) {
    return NextResponse.redirect(
      new URL(`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`, request.url),
      303,
    );
  }
  if (!apiResponse.ok) {
    return fail("evaluate-failed");
  }

  const payload = (await apiResponse.json()) as { data?: { id?: string } };
  const runId = payload.data?.id;
  if (typeof runId !== "string" || runId === "") {
    return fail("evaluate-failed");
  }
  return NextResponse.redirect(new URL(`/app/compatibility/${runId}`, request.url), 303);
}
