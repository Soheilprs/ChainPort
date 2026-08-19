import { DomainValidationError } from "./errors.js";

const OWNER_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
const REPO_PATTERN = /^[a-zA-Z0-9._-]+$/;

export interface GitHubRepositoryRef {
  host: "github.com";
  owner: string;
  repo: string;
  url: string;
}

function stripGitSuffix(value: string): string {
  return value.endsWith(".git") ? value.slice(0, -4) : value;
}

export function parseGitHubRepositoryUrl(input: string): GitHubRepositoryRef {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new DomainValidationError("repository URL is required");
  }

  let url: URL;
  try {
    if (/^git@github\.com:/i.test(trimmed)) {
      const path = trimmed.replace(/^git@github\.com:/i, "");
      url = new URL(`https://github.com/${path}`);
    } else if (trimmed.startsWith("github.com/")) {
      url = new URL(`https://${trimmed}`);
    } else {
      url = new URL(trimmed);
    }
  } catch {
    throw new DomainValidationError("repository URL is invalid");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new DomainValidationError("repository URL must be HTTPS");
  }
  if (url.hostname.toLowerCase() !== "github.com") {
    throw new DomainValidationError("only github.com repositories are supported");
  }

  const segments = url.pathname.split("/").filter((segment) => segment.length > 0);
  const owner = segments[0];
  const repoSegment = segments[1];
  if (owner === undefined || repoSegment === undefined) {
    throw new DomainValidationError("repository URL must include owner and repository name");
  }

  const repo = stripGitSuffix(repoSegment);
  if (
    !OWNER_PATTERN.test(owner) ||
    owner.toLowerCase() === "orgs" ||
    owner.toLowerCase() === "users"
  ) {
    throw new DomainValidationError("repository owner is invalid");
  }
  if (!REPO_PATTERN.test(repo) || repo === "." || repo === "..") {
    throw new DomainValidationError("repository name is invalid");
  }

  return {
    host: "github.com",
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
  };
}

export function githubRepositoryName(ref: GitHubRepositoryRef): string {
  return `${ref.owner}/${ref.repo}`;
}
