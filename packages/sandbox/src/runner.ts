import { chmod } from "node:fs/promises";

import { createId } from "@chainport/shared";

import { dockerEnvFlags, runDocker } from "./docker.js";
import { sandboxEnvironment } from "./env.js";
import { SANDBOX_POLICY, SandboxPolicyError, assertSandboxPolicy } from "./policy.js";

export interface SandboxLimits {
  memoryBytes: number;
  cpus: number;
  pids: number;
}

export interface PrepareSandboxInput {
  image: string;
  workspaceHost: string;
  limits: SandboxLimits;
  env?: Readonly<Record<string, string>>;
}

export interface SandboxHandle {
  id: string;
  containerName: string;
  image: string;
  imageDigest: string;
  workspaceHost: string;
}

export interface ExecOptions {
  argv: readonly string[];
  timeoutMs: number;
  network: "none" | "install";
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

export interface SandboxRunner {
  prepare(input: PrepareSandboxInput): Promise<SandboxHandle>;
  execute(handle: SandboxHandle, options: ExecOptions): Promise<ExecResult>;
  destroy(handle: SandboxHandle): Promise<void>;
  inspectDigest(image: string): Promise<string>;
  reapOrphans(): Promise<void>;
}

const LABEL = "chainport.validation";
const INSTALL_NETWORK = "chainport-sandbox-install";

export class DockerSandboxRunner implements SandboxRunner {
  public async inspectDigest(image: string): Promise<string> {
    const digest = await runDocker(
      [
        "image",
        "inspect",
        "--format",
        "{{if .RepoDigests}}{{index .RepoDigests 0}}{{else}}{{.Id}}{{end}}",
        image,
      ],
      { timeoutMs: 15_000 },
    );
    if (digest.code !== 0 || digest.stdout.trim() === "") {
      throw new SandboxPolicyError(`sandbox image ${image} is not available locally`);
    }
    return digest.stdout.trim();
  }

  public async prepare(input: PrepareSandboxInput): Promise<SandboxHandle> {
    assertSandboxPolicy({
      location: "isolated-container",
      privileged: false,
      dockerSocketMounted: false,
    });
    if (SANDBOX_POLICY.executeOnHost) {
      throw new SandboxPolicyError("host execution is forbidden");
    }
    await chmod(input.workspaceHost, 0o777).catch(() => undefined);
    await ensureInstallNetwork();
    const id = createId();
    const containerName = `chainport-val-${id}`;
    const env = sandboxEnvironment(input.env ?? {});
    const created = await runDocker(
      [
        "create",
        "--name",
        containerName,
        "--label",
        `${LABEL}=1`,
        "--label",
        `${LABEL}.id=${id}`,
        "--user",
        "10001:10001",
        "--read-only",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--network",
        "none",
        "--memory",
        String(input.limits.memoryBytes),
        "--cpus",
        String(input.limits.cpus),
        "--pids-limit",
        String(input.limits.pids),
        "--tmpfs",
        "/tmp:rw,exec,nosuid,size=268435456",
        "--mount",
        `type=bind,src=${input.workspaceHost},dst=/workspace`,
        "--workdir",
        "/workspace",
        "--add-host",
        "host.docker.internal:127.0.0.1",
        "--add-host",
        "gateway.docker.internal:127.0.0.1",
        "--add-host",
        "metadata.google.internal:127.0.0.1",
        ...dockerEnvFlags(env),
        "--entrypoint",
        "sleep",
        input.image,
        "86400",
      ],
      { timeoutMs: 30_000 },
    );
    if (created.code !== 0) {
      throw new SandboxPolicyError(`sandbox create failed: ${created.stderr.trim()}`);
    }
    const started = await runDocker(["start", containerName], { timeoutMs: 15_000 });
    if (started.code !== 0) {
      await runDocker(["rm", "-f", containerName], { timeoutMs: 15_000 });
      throw new SandboxPolicyError(`sandbox start failed: ${started.stderr.trim()}`);
    }
    const inspect = await runDocker(
      [
        "inspect",
        "--format",
        "{{.HostConfig.Privileged}} {{json .Mounts}} {{.HostConfig.Runtime}}",
        containerName,
      ],
      { timeoutMs: 10_000 },
    );
    if (inspect.stdout.includes("docker.sock") || inspect.stdout.startsWith("true ")) {
      await runDocker(["rm", "-f", containerName], { timeoutMs: 15_000 });
      throw new SandboxPolicyError("sandbox policy violation: privileged or docker socket");
    }
    await runDocker(
      [
        "exec",
        "-u",
        "10001:10001",
        containerName,
        "sh",
        "-c",
        "mkdir -p /tmp/home/.svm && if [ -d /usr/local/svm ]; then cp -a /usr/local/svm/. /tmp/home/.svm/; fi",
      ],
      { timeoutMs: 10_000 },
    );
    const digest = await this.inspectDigest(input.image);
    return {
      id,
      containerName,
      image: input.image,
      imageDigest: digest,
      workspaceHost: input.workspaceHost,
    };
  }

  public async execute(handle: SandboxHandle, options: ExecOptions): Promise<ExecResult> {
    if (options.argv.length === 0) {
      throw new SandboxPolicyError("sandbox command is empty");
    }
    if (options.network === "install") {
      await runDocker(["network", "connect", INSTALL_NETWORK, handle.containerName], {
        timeoutMs: 15_000,
      });
    }
    const started = Date.now();
    try {
      const result = await runDocker(
        [
          "exec",
          "-u",
          "10001:10001",
          "-w",
          "/workspace",
          handle.containerName,
          "timeout",
          "--signal=KILL",
          String(Math.max(1, Math.ceil(options.timeoutMs / 1000))),
          ...options.argv,
        ],
        { timeoutMs: options.timeoutMs + 5_000 },
      );
      return {
        exitCode: result.timedOut ? 124 : result.code,
        stdout: result.stdout,
        stderr: result.stderr,
        timedOut: result.timedOut || result.code === 124,
        durationMs: Date.now() - started,
      };
    } finally {
      if (options.network === "install") {
        await runDocker(["network", "disconnect", INSTALL_NETWORK, handle.containerName], {
          timeoutMs: 15_000,
        });
      }
    }
  }

  public async destroy(handle: SandboxHandle): Promise<void> {
    const removed = await runDocker(["rm", "-f", handle.containerName], { timeoutMs: 20_000 });
    if (removed.code !== 0) {
      throw new SandboxPolicyError(`sandbox cleanup failed: ${removed.stderr.trim()}`);
    }
    const leftover = await runDocker(["ps", "-aq", "--filter", `name=^${handle.containerName}$`], {
      timeoutMs: 10_000,
    });
    if (leftover.stdout.trim() !== "") {
      throw new SandboxPolicyError("sandbox container still present after destroy");
    }
  }

  public async reapOrphans(): Promise<void> {
    const listed = await runDocker(["ps", "-aq", "--filter", `label=${LABEL}=1`], {
      timeoutMs: 15_000,
    });
    const ids = listed.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    for (const id of ids) {
      await runDocker(["rm", "-f", id], { timeoutMs: 20_000 });
    }
  }
}

async function ensureInstallNetwork(): Promise<void> {
  const existing = await runDocker(["network", "inspect", INSTALL_NETWORK], { timeoutMs: 10_000 });
  if (existing.code === 0) {
    return;
  }
  const created = await runDocker(["network", "create", "--driver", "bridge", INSTALL_NETWORK], {
    timeoutMs: 15_000,
  });
  if (created.code !== 0 && !created.stderr.includes("already exists")) {
    throw new SandboxPolicyError(`sandbox install network failed: ${created.stderr.trim()}`);
  }
}
