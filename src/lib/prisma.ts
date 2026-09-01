import { PrismaClient } from "@prisma/client";

/**
 * Single shared Prisma client. In dev, `tsx watch` reloads the module graph on
 * every change, so we stash the client on `globalThis` to avoid opening a new
 * connection pool per reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
