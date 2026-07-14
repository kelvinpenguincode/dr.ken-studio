import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/**
 * Vercel + Supabase: use Transaction pooler (port 6543) with pgbouncer=true.
 * Session mode (pooler :5432) caps at ~15 clients and throws EMAXCONNSESSION.
 * Serverless also needs a tiny Prisma pool (connection_limit=1).
 */
function databaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not set");
  }

  try {
    const url = new URL(raw);

    // Soft warning for the mode that exhausts free-tier pools
    const isPooler = url.hostname.includes("pooler.supabase.com");
    if (isPooler && url.port === "5432") {
      console.warn(
        "[prisma] DATABASE_URL looks like Supabase Session pooler (:5432). Switch to Transaction pooler (:6543) with ?pgbouncer=true&connection_limit=1 to avoid EMAXCONNSESSION.",
      );
    }

    if (!url.searchParams.has("pgbouncer") && isPooler) {
      url.searchParams.set("pgbouncer", "true");
    }
    if (!url.searchParams.has("sslmode")) {
      url.searchParams.set("sslmode", "require");
    }
    // Critical on serverless — default Prisma pool is far too large for 15 slots
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "20");
    }

    return url.toString();
  } catch {
    return raw;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Reuse client across hot reloads and warm serverless isolates
globalForPrisma.prisma = prisma;
