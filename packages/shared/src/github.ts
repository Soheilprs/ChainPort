import { DomainValidationError } from "./errors.js";

const OWNER_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
const REPO_PATTERN = /^[a-zA-Z0-9._-]+$/;
const CREDENTIAL_IN_URL = /^[a-z][a-z0-9+.-]*:\/\/[^/]*@/i;

export interface GitHubRepositoryRef {
  host: "github.com";
  owner: string;
  repo: string;
  url: string;
}

function stripGitSuffix(value: string): string {
  return value.endsWith(".git") ? value.slice(0, -4) : value;
}

function hostnameOf(url: URL): string {
  return url.hostname.replace(/\.$/, "").toLowerCase();
}

export function parseGitHubRepositoryUrl(input: string): GitHubRepositoryRef {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new DomainValidationError("repository URL is required");
  }
  if (/^git@/i.test(trimmed) || /^ssh:\/\//i.test(trimmed)) {
    throw new DomainValidationError("SSH repository URLs are not supported");
  }
  if (CREDENTIAL_IN_URL.test(trimmed)) {
    throw new DomainValidationError("repository URL must not contain credentials");
  }

  let url: URL;
  try {
    if (trimmed.startsWith("github.com/")) {
      url = new URL(`https://${trimmed}`);
    } else {
      url = new URL(trimmed);
    }
  } catch {
    throw new DomainValidationError("repository URL is invalid");
  }

  if (url.username !== "" || url.password !== "") {
    throw new DomainValidationError("repository URL must not contain credentials");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new DomainValidationError("repository URL must be HTTPS");
  }
  const host = hostnameOf(url);
  if (host !== "github.com") {
    throw new DomainValidationError("only github.com repositories are supported");
  }
  const allowedPort = url.protocol === "https:" ? "443" : "80";
  if (url.port !== "" && url.port !== allowedPort) {
    throw new DomainValidationError("repository URL must not use a custom port");
  }

  const segments = url.pathname.split("/").filter((segment) => segment.length > 0);
  const owner = segments[0];
  const repoSegment = segments[1];
  if (owner === undefined || repoSegment === undefined) {
    throw new DomainValidationError("repository URL must include owner and repository name");
  }

  const repo = stripGitSuffix(decodeURIComponent(repoSegment));
  const decodedOwner = decodeURIComponent(owner);
  if (
    !OWNER_PATTERN.test(decodedOwner) ||
    decodedOwner.toLowerCase() === "orgs" ||
    decodedOwner.toLowerCase() === "users"
  ) {
    throw new DomainValidationError("repository owner is invalid");
  }
  if (!REPO_PATTERN.test(repo) || repo === "." || repo === "..") {
    throw new DomainValidationError("repository name is invalid");
  }

  return {
    host: "github.com",
    owner: decodedOwner,
    repo,
    url: `https://github.com/${decodedOwner}/${repo}`,
  };
}

export function githubRepositoryName(ref: GitHubRepositoryRef): string {
  return `${ref.owner}/${ref.repo}`;
}

export function githubHttpsCloneUrl(ref: GitHubRepositoryRef): string {
  return `https://github.com/${ref.owner}/${ref.repo}.git`;
}

export function githubApiRepositoryUrl(apiBaseUrl: string, ref: GitHubRepositoryRef): string {
  const base = new URL(apiBaseUrl);
  if (base.protocol !== "https:" || hostnameOf(base) !== "api.github.com") {
    throw new DomainValidationError("GitHub API base URL is invalid");
  }
  return `https://api.github.com/repos/${ref.owner}/${ref.repo}`;
}
