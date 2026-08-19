import {
  INGEST_ERROR_MESSAGES,
  type IngestErrorCode,
  isRetryableIngestError,
} from "@chainport/shared";

export class IngestError extends Error {
  public readonly retryable: boolean;

  public constructor(
    public readonly code: IngestErrorCode,
    message: string = INGEST_ERROR_MESSAGES[code],
  ) {
    super(message);
    this.name = "IngestError";
    this.retryable = isRetryableIngestError(code);
  }
}
