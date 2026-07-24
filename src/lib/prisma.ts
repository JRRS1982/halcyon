import { env } from "@/lib/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Singleton — Next.js dev hot-reload would otherwise create a new PrismaClient
// per code reload and exhaust the connection pool. Stash on globalThis in
// development so the same instance is reused.
declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClient | undefined;
}

// Prisma 7 connects through a node-postgres driver adapter rather than a bundled
// engine. The adapter reads the pooled runtime URL (`DATABASE_URL`); migrations
// use `DIRECT_URL` via prisma.config.ts.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma =
  globalThis.prismaClient ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaClient = prisma;
}
