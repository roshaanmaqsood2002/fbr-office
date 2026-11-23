import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  FBR_SECRET_KEY: z
    .string()
    .regex(
      /^[0-9a-fA-F]{64}$/,
      "FBR_SECRET_KEY must be 64 hex characters (32 bytes)",
    ),
  FBR_ADAPTER: z.enum(["mock", "http"]).default("mock"),
  FBR_QUEUE_POLL_MS: z.coerce.number().default(5000),
  FBR_MAX_ATTEMPTS: z.coerce.number().default(5),
  FBR_RETRY_BASE_SECONDS: z.coerce.number().default(30),
  FBR_API_BASE_SANDBOX: z.string().optional(),
  FBR_API_BASE_PRODUCTION: z.string().optional(),
  FBR_GATEWAY_URL: z.string().default("https://gw.fbr.gov.pk"),
  FBR_SANDBOX_SUFFIX: z.string().default("_sb"),
  FBR_HTTP_TIMEOUT_MS: z.coerce.number().default(30000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
