export class PersistenceError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PersistenceError";
  }
}

export class UniqueConstraintError extends PersistenceError {
  public constructor(
    message = "a unique constraint was violated",
    public readonly target: readonly string[] = [],
  ) {
    super(message);
    this.name = "UniqueConstraintError";
  }
}

export class ForeignKeyError extends PersistenceError {
  public constructor(message = "a referenced record does not exist") {
    super(message);
    this.name = "ForeignKeyError";
  }
}
