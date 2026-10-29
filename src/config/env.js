import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  BOT_TOKEN: z.string().min(10),
  DATABASE_URL: z.string().min(1),
  ADMIN_IDS: z.string().default(""),
  BOT_MODE: z.enum(["polling"]).default("polling"),
  LOG_LEVEL: z.string().default("info"),
  MIN_AGE: z.coerce.number().int().min(18).default(18),
  COMMISSION_BPS: z.coerce.number().int().min(0).max(5000).default(1000),
  TERMS_VERSION: z.string().default("2026-10-v1")
});

export const env = schema.parse(process.env);
export const adminIds = new Set(
  env.ADMIN_IDS.split(",").map((v) => v.trim()).filter(Boolean)
);
