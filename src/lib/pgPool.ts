import { Pool } from "pg";
import { env } from "./env";

/**
 * A small pg Pool used only by connect-pg-simple for the session store.
 * Application data goes through Prisma; this is deliberately separate and tiny.
 */
const globalForPool = globalThis as unknown as { sessionPool?: Pool };

export const sessionPool =
  globalForPool.sessionPool ?? new Pool({ connectionString: env.DATABASE_URL, max: 3 });

if (!env.isProd) globalForPool.sessionPool = sessionPool;
