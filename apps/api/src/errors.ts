export class ApiRequestError extends Error {
  public readonly retryAfterSeconds?: number;

  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    options: { retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = "ApiRequestError";
    if (options.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = options.retryAfterSeconds;
    }
  }
}
