import { Prisma, PrismaClient } from "@prisma/client";

import { ForeignKeyError, PersistenceError, UniqueConstraintError } from "./errors.js";

let sharedClient: PrismaClient | undefined;

export type DatabaseClient = PrismaClient;

export function getDatabaseClient(): PrismaClient {
  sharedClient ??= new PrismaClient();
  return sharedClient;
}

export async function disconnectDatabase(
  client: PrismaClient = getDatabaseClient(),
): Promise<void> {
  await client.$disconnect();
  if (client === sharedClient) {
    sharedClient = undefined;
  }
}

export async function checkDatabase(client: PrismaClient = getDatabaseClient()): Promise<void> {
  try {
    await client.$queryRaw`SELECT 1`;
  } catch {
    throw new PersistenceError("database is unavailable");
  }
}

export function rethrowPersistenceError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new UniqueConstraintError();
    }
    if (error.code === "P2003") {
      throw new ForeignKeyError();
    }
  }
  throw error;
}

export { Prisma, PrismaClient };
