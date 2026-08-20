import { DeploymentEngineError } from "./errors.js";
import { assertSafeCandidatePath } from "./candidates.js";

export interface DeploymentCommand {
  argv: readonly string[];
  description: string;
}

export function foundrySimulateCommand(filePath: string): DeploymentCommand {
  const safe = assertSafeCandidatePath(filePath);
  return {
    argv: [
      "sh",
      "-c",
      'forge script "$CHAINPORT_SCRIPT" --rpc-url "$ETH_RPC_URL" --private-key "$PRIVATE_KEY" --sender "$CHAINPORT_DEPLOYER" -vvvv',
    ],
    description: `forge script ${safe} (simulate, no broadcast)`,
  };
}

export function foundryBroadcastCommand(filePath: string): DeploymentCommand {
  const safe = assertSafeCandidatePath(filePath);
  return {
    argv: [
      "sh",
      "-c",
      'forge script "$CHAINPORT_SCRIPT" --rpc-url "$ETH_RPC_URL" --private-key "$PRIVATE_KEY" --sender "$CHAINPORT_DEPLOYER" --broadcast --slow -vvvv',
    ],
    description: `forge script ${safe} --broadcast`,
  };
}

export function rejectArbitraryCommand(body: unknown): void {
  if (body === null || typeof body !== "object") {
    return;
  }
  const record = body as Record<string, unknown>;
  for (const key of ["command", "shellCommand", "argv", "rpcUrl", "privateKey", "filePath"]) {
    if (key in record) {
      throw new DeploymentEngineError(
        key === "rpcUrl" ? "ARBITRARY_RPC_REJECTED" : "ARBITRARY_COMMAND_REJECTED",
      );
    }
  }
}
