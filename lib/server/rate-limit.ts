import "server-only";
import Redis from "ioredis";
import { env } from "@/lib/server/env";

const globalForRedis = globalThis as unknown as { redis?: Redis };
const redis = globalForRedis.redis ?? new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

const fallback = new Map<string, { count: number; expires: number }>();

export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  try {
    if (redis.status === "wait") await redis.connect();
    const value = await redis.incr(key);
    if (value === 1) await redis.expire(key, windowSeconds);
    return { allowed: value <= limit, remaining: Math.max(0, limit - value) };
  } catch {
    const now = Date.now();
    const current = fallback.get(key);
    const next = !current || current.expires < now
      ? { count: 1, expires: now + windowSeconds * 1000 }
      : { ...current, count: current.count + 1 };
    fallback.set(key, next);
    return { allowed: next.count <= limit, remaining: Math.max(0, limit - next.count) };
  }
}
