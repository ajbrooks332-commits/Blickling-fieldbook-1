import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Conservative, environment-configurable pool limits. Statement timeout stops
// runaway queries; application_name makes connections identifiable in pg_stat.
const intEnv = (name: string, fallback: number) => {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: intEnv("PGPOOL_MAX", 10),
  connectionTimeoutMillis: intEnv("PG_CONNECT_TIMEOUT_MS", 10_000),
  idleTimeoutMillis: intEnv("PG_IDLE_TIMEOUT_MS", 30_000),
  statement_timeout: intEnv("PG_STATEMENT_TIMEOUT_MS", 30_000),
  application_name: process.env.PG_APPLICATION_NAME ?? "blickling-fieldbook-api",
});
export const db = drizzle(pool, { schema });

export * from "./schema";
