import {
  githubApiRepositoryUrl,
  type GitHubRepositoryRef,
  INGEST_ERROR_MESSAGES,
} from "@chainport/shared";

import { IngestError } from "./errors.js";

export interface GitHubRepositoryMetadata {
  defaultBranch: string;
  sizeKilobytes: number;
  private: boolean;
}

export interface GitHubMetadataClient {
  lookup(ref: GitHubRepositoryRef): Promise<GitHubRepositoryMetadata>;
}

export class HttpGitHubMetadataClient implements GitHubMetadataClient {
  public constructor(
    private readonly apiBaseUrl: string,
    private readonly timeoutMs: number,
    private readonly authorizationHeader?: string,
  ) {}

  public async lookup(ref: GitHubRepositoryRef): Promise<GitHubRepositoryMetadata> {
    const url = githubApiRepositoryUrl(this.apiBaseUrl, ref);
    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "ChainPort",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(this.authorizationHeader === undefined
            ? {}
            : { Authorization: this.authorizationHeader }),
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new IngestError("CLONE_TIMEOUT");
      }
      throw new IngestError("CLONE_FAILED");
    }

    if (response.status === 404) {
      throw new IngestError("REPOSITORY_NOT_FOUND");
    }
    if (response.status === 401 || response.status === 403) {
      if (this.authorizationHeader !== undefined) {
        throw new IngestError("GITHUB_ACCESS_REVOKED", INGEST_ERROR_MESSAGES.GITHUB_ACCESS_REVOKED);
      }
      throw new IngestError("REPOSITORY_PRIVATE", INGEST_ERROR_MESSAGES.REPOSITORY_PRIVATE);
    }
    if (!response.ok) {
      throw new IngestError("CLONE_FAILED");
    }

    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null) {
      throw new IngestError("CLONE_FAILED");
    }
    const record = body as Record<string, unknown>;
    if (record.private === true) {
      throw new IngestError("REPOSITORY_PRIVATE");
    }
    const defaultBranch =
      typeof record.default_branch === "string" && record.default_branch.length > 0
        ? record.default_branch
        : "main";
    const sizeKilobytes = typeof record.size === "number" && record.size >= 0 ? record.size : 0;
    return { defaultBranch, sizeKilobytes, private: false };
  }
}
