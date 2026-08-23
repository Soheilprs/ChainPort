import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@chainport/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function clientApiUrl(): string {
  if (typeof window === "undefined") {
    return API_URL;
  }
  try {
    const url = new URL(API_URL, window.location.origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return "/backend";
    }
    return url.origin === window.location.origin ? API_URL : API_URL;
  } catch {
    return API_URL.startsWith("/") ? API_URL : "/backend";
  }
}

export interface ApiHealth {
  status: "ok" | "unreachable";
  phase?: number;
}

export interface ApiError {
  status: "error";
  code: string;
  message: string;
}

export interface PartnerSummary {
  slug: string;
  displayName: string;
  networkKey: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  repositoryId: string;
  githubOwner: string;
  githubRepo: string;
  githubUrl: string;
  status: string;
  createdAt: string;
  networkPartnerId?: string | null;
  acquisitionSource?: string;
  partner?: PartnerSummary | null;
}

export interface RepositorySummary {
  id: string;
  provider: string;
  owner: string;
  name: string;
  normalizedUrl: string;
  defaultBranch: string | null;
  resolvedCommitSha: string | null;
  cloneStatus: string;
  clonedAt: string | null;
  sizeBytes: number | null;
}

export interface JobSummary {
  id: string;
  projectId: string;
  repositoryId: string;
  sourceChainKey: string;
  targetChainKey: string;
  status: string;
  repoSha: string | null;
  attempt: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ChainSummary {
  key: string;
  name: string;
  chainId: number;
  roles: readonly string[];
}

async function readJson(response: Response): Promise<unknown> {
  return response.json() as Promise<unknown>;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }
  const prefix = `${name}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }
  return undefined;
}

const CSRF_STORAGE_KEY = "chainport_csrf";

export function rememberCsrfToken(token: string): void {
  if (typeof window === "undefined" || token === "") {
    return;
  }
  window.sessionStorage.setItem(CSRF_STORAGE_KEY, token);
}

function mutationHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const csrf =
    readCookie(CSRF_COOKIE_NAME) ??
    (typeof window === "undefined" ? undefined : window.sessionStorage.getItem(CSRF_STORAGE_KEY));
  if (csrf !== undefined && csrf !== null && csrf !== "") {
    headers[CSRF_HEADER_NAME] = csrf;
  }
  return headers;
}

function redirectToSignIn(): void {
  if (typeof window === "undefined") {
    return;
  }
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/auth/sign-in?returnTo=${encodeURIComponent(next)}`);
}

function asApiError(body: unknown, fallback: string): ApiError {
  const error = body as ApiError;
  return {
    status: "error",
    code: typeof error.code === "string" ? error.code : "INTERNAL_ERROR",
    message: typeof error.message === "string" ? error.message : fallback,
  };
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
    const body = (await readJson(response)) as { status?: string; phase?: number };
    if (body.status !== "ok") {
      return { status: "unreachable" };
    }
    return body.phase === undefined ? { status: "ok" } : { status: "ok", phase: body.phase };
  } catch {
    return { status: "unreachable" };
  }
}

export async function fetchChains(): Promise<ChainSummary[]> {
  const response = await fetch(`${API_URL}/v1/chains`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to load chain catalog");
  }
  const body = (await readJson(response)) as { data?: ChainSummary[] };
  return body.data ?? [];
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const response = await fetch(`${API_URL}/v1/projects`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to load projects");
  }
  const body = (await readJson(response)) as { data?: ProjectSummary[] };
  return body.data ?? [];
}

export type CreateProjectResult =
  | { ok: true; project: ProjectSummary; job: JobSummary }
  | { ok: false; error: ApiError };

export async function createProject(input: {
  repositoryUrl: string;
  sourceChainKey: string;
  targetChainKey: string;
}): Promise<CreateProjectResult> {
  const response = await fetch(`${clientApiUrl()}/v1/projects`, {
    method: "POST",
    headers: mutationHeaders(),
    credentials: "include",
    body: JSON.stringify(input),
  });
  const body = await readJson(response);
  if (response.status === 401) {
    redirectToSignIn();
    return {
      ok: false,
      error: asApiError(body, "Sign in is required to start ingest"),
    };
  }
  if (!response.ok) {
    return { ok: false, error: asApiError(body, "Request failed") };
  }
  const payload = body as { data: { project: ProjectSummary; job: JobSummary } };
  return { ok: true, project: payload.data.project, job: payload.data.job };
}

export async function createPartnerProject(input: {
  slug: string;
  repositoryUrl: string;
  sourceChainKey: string;
}): Promise<CreateProjectResult> {
  const response = await fetch(`${clientApiUrl()}/v1/public/partners/${input.slug}/projects`, {
    method: "POST",
    headers: mutationHeaders(),
    credentials: "include",
    body: JSON.stringify({
      repositoryUrl: input.repositoryUrl,
      sourceChainKey: input.sourceChainKey,
    }),
  });
  const body = await readJson(response);
  if (response.status === 401) {
    redirectToSignIn();
    return {
      ok: false,
      error: asApiError(body, "Sign in is required to start ingest"),
    };
  }
  if (!response.ok) {
    return { ok: false, error: asApiError(body, "Request failed") };
  }
  const payload = body as { data: { project: ProjectSummary; job: JobSummary } };
  return { ok: true, project: payload.data.project, job: payload.data.job };
}

export async function fetchCurrentUser(): Promise<{ id: string; email: string } | null> {
  const response = await fetch(`${clientApiUrl()}/v1/auth/me`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!response.ok) {
    return null;
  }
  const body = (await readJson(response)) as {
    data?: { user?: { id: string; email: string } | null };
  };
  return body.data?.user ?? null;
}

export async function fetchJob(jobId: string): Promise<{
  job: JobSummary;
  project: ProjectSummary;
  repository: RepositorySummary;
} | null> {
  const response = await fetch(`${clientApiUrl()}/v1/jobs/${jobId}`, {
    cache: "no-store",
    credentials: "include",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("Unable to load job");
  }
  const body = (await readJson(response)) as {
    data: { job: JobSummary; project: ProjectSummary; repository: RepositorySummary };
  };
  return body.data;
}
