import { DEPLOYMENT_ERROR_MESSAGES, type DeploymentErrorCode } from "@chainport/shared";

export class DeploymentEngineError extends Error {
  public constructor(
    public readonly code: DeploymentErrorCode,
    message: string = DEPLOYMENT_ERROR_MESSAGES[code],
  ) {
    super(message);
    this.name = "DeploymentEngineError";
  }
}
