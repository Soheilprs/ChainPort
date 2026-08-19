import { CURRENT_PHASE, NotImplementedError } from "@chainport/shared";

export class SandboxPolicyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SandboxPolicyError";
  }
}

export const SANDBOX_POLICY = {
  executeOnHost: false,
  privileged: false,
  mountDockerSocket: false,
  networkMode: "restricted",
  readOnlyRootFilesystem: true,
  dropAllCapabilities: true,
  noNewPrivileges: true,
} as const;

export type ExecutionLocation = "host" | "isolated-container";

export interface SandboxExecutionRequest {
  location: ExecutionLocation;
  privileged?: boolean;
  dockerSocketMounted?: boolean;
}

export function assertSandboxPolicy(request: SandboxExecutionRequest): void {
  if (request.location === "host") {
    throw new SandboxPolicyError("repository code must not execute on the host");
  }
  if (request.privileged === true) {
    throw new SandboxPolicyError("sandbox containers must not run privileged");
  }
  if (request.dockerSocketMounted === true) {
    throw new SandboxPolicyError("the host Docker socket must not be mounted into the sandbox");
  }
}

export function assertSandboxRunnerAvailable(): never {
  throw new NotImplementedError("isolated sandbox runner", CURRENT_PHASE);
}
