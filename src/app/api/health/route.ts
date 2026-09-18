import { NextResponse } from "next/server";
import { createHealthReader } from "@/lib/health/check";
import { log } from "@/lib/log";
import { prisma } from "@/lib/prisma";

/**
 * Liveness probe for the deployed app.
 *
 * Answers one question: is this instance serving, and can it reach the
 * database? The smoke workflow asserts on it after every successful production
 * deployment — a deployment record says Vercel promoted a build, not that the
 * build works.
 *
 * Deliberately boring output. No version, commit, environment, region or
 * connection detail: this is public and unauthenticated, and each of those is
 * a free gift to someone deciding whether to bother attacking you.
 *
 * SELECT 1 rather than a real query — the question is whether the connection
 * pool can reach Postgres, not whether any particular table is intact.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Module scope, so the cache survives between requests to the same instance.
const readHealth = createHealthReader(() => prisma.$queryRaw`SELECT 1`, {
  ttlMs: 5_000,
  now: () => Date.now(),
});

export async function GET() {
  const report = await readHealth();

  if (report.db === "error") {
    // The detail the response withholds goes here instead, where it is useful
    // and not public.
    log.error("Health probe could not reach the database");
  }

  return NextResponse.json(report, {
    status: report.status === "ok" ? 200 : 503,
    // A cached health check is a health check for whenever it was cached.
    headers: { "Cache-Control": "no-store" },
  });
}
