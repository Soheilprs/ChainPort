export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface ApiHealth {
  status: "ok" | "unreachable";
  phase?: number;
}

export interface ApiError {
  status: "error";
  code: string;
  message: string;
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
  const response = await fetch(`${API_URL}/v1/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readJson(response);
  if (!response.ok) {
    const error = body as ApiError;
    return {
      ok: false,
      error: {
        status: "error",
        code: typeof error.code === "string" ? error.code : "INTERNAL_ERROR",
        message: typeof error.message === "string" ? error.message : "Request failed",
      },
    };
  }
  const payload = body as { data: { project: ProjectSummary; job: JobSummary } };
  return { ok: true, project: payload.data.project, job: payload.data.job };
}

export async function fetchJob(jobId: string): Promise<{
  job: JobSummary;
  project: ProjectSummary;
  repository: RepositorySummary;
} | null> {
  const response = await fetch(`${API_URL}/v1/jobs/${jobId}`, { cache: "no-store" });
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
