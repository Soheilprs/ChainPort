import { spawn } from "node:child_process";

import { IngestError } from "./errors.js";

const SAFE_GIT_CONFIG = [
  "-c",
  "core.hooksPath=/dev/null",
  "-c",
  "core.fsmonitor=false",
  "-c",
  "protocol.ext.allow=never",
  "-c",
  "filter.lfs.required=false",
  "-c",
  "filter.lfs.smudge=",
  "-c",
  "filter.lfs.process=",
  "-c",
  "filter.lfs.clean=",
] as const;

const REMOTE_ONLY_GIT_CONFIG = ["-c", "protocol.file.allow=never"] as const;

export function safeGitEnv(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_OPTIONAL_LOCKS: "0",
    LC_ALL: "C",
  };
}

export interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

export async function runGit(
  args: readonly string[],
  options: { cwd?: string; timeoutMs: number; allowLocalPath?: boolean },
): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    const config =
      options.allowLocalPath === true
        ? SAFE_GIT_CONFIG
        : [...SAFE_GIT_CONFIG, ...REMOTE_ONLY_GIT_CONFIG];
    const child = spawn("git", [...config, ...args], {
      cwd: options.cwd,
      env: safeGitEnv(),
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new IngestError("CLONE_TIMEOUT"));
    }, options.timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new IngestError("CLONE_FAILED", error.message));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

export function classifyGitFailure(stderr: string): IngestError {
  const text = stderr.toLowerCase();
  if (text.includes("not found") || text.includes("repository not found")) {
    return new IngestError("REPOSITORY_NOT_FOUND");
  }
  if (text.includes("authentication failed") || text.includes("could not read username")) {
    return new IngestError("REPOSITORY_PRIVATE");
  }
  return new IngestError("CLONE_FAILED");
}
