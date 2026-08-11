import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  REDIS_URL: z.string().url(),
  // MinIO / S3 storage is temporarily disabled. Restore these fields when a
  // production bucket is connected.
  // STORAGE_ENDPOINT: z.string().url(),
  // STORAGE_PUBLIC_ENDPOINT: z.string().url(),
  // STORAGE_ANALYZER_ENDPOINT: z.string().url(),
  // STORAGE_REGION: z.string().min(1),
  // STORAGE_BUCKET: z.string().min(1),
  // STORAGE_ACCESS_KEY_ID: z.string().min(1),
  // STORAGE_SECRET_ACCESS_KEY: z.string().min(8),
  ANALYZER_BACKEND: z.enum(["ai-sdk", "python"]).default("ai-sdk"),
  AI_ANALYZER_URL: z.string().url(),
  PYTHON_ANALYZER_URL: z.string().url(),
  CALLBACK_BASE_URL: z.string().url(),
  WEB_TO_PYTHON_HMAC_KEYS: z
    .string()
    .min(20),
  PYTHON_TO_WEB_HMAC_KEYS: z
    .string()
    .min(20),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).default("gemini-3.6-flash"),
  AI_FALLBACK_MODELS: z
    .string()
    .default("gemini-3.1-flash-lite,gemini-2.5-flash"),
});

export const env = schema.parse(process.env);
