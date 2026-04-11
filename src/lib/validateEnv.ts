import dotenv from "dotenv";
import path from "path";

const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath, override: false });

const required = [
  "DATABASE_URL",
  "DIRECT_URL",
  "REDIS_URL",
  "JWT_SECRET",
  "ENCRYPTION_KEY"
];

export function validateEnv(): void {
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
}
