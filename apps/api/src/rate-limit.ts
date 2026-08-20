import type { Redis } from "ioredis";

import { ApiRequestError } from "./errors.js";

export class RateLimiter {
  public constructor(private readonly redis: Redis | undefined) {}

  public async consume(key: string, limit: number, windowSeconds: number): Promise<void> {
    if (this.redis === undefined) {
      return;
    }
    const redisKey = `rl:${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.expire(redisKey, windowSeconds);
    }
    if (count > limit) {
      const ttl = await this.redis.ttl(redisKey);
      throw new ApiRequestError(429, "RATE_LIMITED", "Too many requests", {
        retryAfterSeconds: Math.max(ttl, 1),
      });
    }
  }
}
