import { spawn } from "node:child_process";

export interface DockerResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export async function runDocker(
  args: readonly string[],
  options: { timeoutMs: number } = { timeoutMs: 60_000 },
): Promise<DockerResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [...args], {
      env: { PATH: process.env.PATH, HOME: process.env.HOME, DOCKER_HOST: process.env.DOCKER_HOST },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr, timedOut });
    });
  });
}

export function dockerEnvFlags(env: Readonly<Record<string, string>>): string[] {
  const flags: string[] = [];
  for (const [key, value] of Object.entries(env)) {
    flags.push("--env", `${key}=${value}`);
  }
  return flags;
}
