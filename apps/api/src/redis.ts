import { PersistenceError } from "@chainport/db";
import type { Redis } from "ioredis";

export async function checkRedis(client: Redis): Promise<void> {
  try {
    const response = await client.ping();
    if (response !== "PONG") {
      throw new PersistenceError("redis is unavailable");
    }
  } catch (error) {
    if (error instanceof PersistenceError) {
      throw error;
    }
    throw new PersistenceError("redis is unavailable");
  }
}
