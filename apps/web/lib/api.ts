export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface ApiHealth {
  status: "ok" | "unreachable";
  phase?: number;
}

export async function fetchApiHealth(): Promise<ApiHealth> {
  try {
    const response = await fetch(`${API_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) {
      return { status: "unreachable" };
    }
    const body = (await response.json()) as { status?: string; phase?: number };
    if (body.status !== "ok") {
      return { status: "unreachable" };
    }
    return body.phase === undefined ? { status: "ok" } : { status: "ok", phase: body.phase };
  } catch {
    return { status: "unreachable" };
  }
}
