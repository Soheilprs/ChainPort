import { cookies } from "next/headers";

import { API_URL } from "@/lib/api";

export function formString(formData: FormData | null, name: string, fallback = ""): string {
  const value = formData?.get(name);
  return typeof value === "string" ? value : fallback;
}

export function csrfFromCookieHeader(cookieHeader: string): string | undefined {
  const match = /(?:^|;\s*)chainport_csrf=([^;]+)/.exec(cookieHeader);
  if (match?.[1] === undefined) {
    return undefined;
  }
  return decodeURIComponent(match[1]);
}

export async function serverApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cookieStore = await cookies();
  const cookie = cookieStore
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");
  return fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.headers ?? {}),
      ...(cookie === "" ? {} : { cookie }),
    },
  });
}
