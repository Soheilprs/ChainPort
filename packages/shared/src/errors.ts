export class DomainValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "DomainValidationError";
  }
}

export class ConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class NotImplementedError extends Error {
  public readonly phase: number;

  public constructor(capability: string, phase: number) {
    super(`${capability} is not implemented in phase ${phase}`);
    this.name = "NotImplementedError";
    this.phase = phase;
  }
}
