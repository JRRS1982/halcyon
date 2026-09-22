import { NextResponse } from "next/server";
import { isAuthorizedBearer } from "@/lib/auth/bearer";
import { emailEnv } from "@/lib/env";
import { clientIp } from "@/lib/http/clientIp";
import { log } from "@/lib/log";
import { prisma } from "@/lib/prisma";
import { withinRateLimit } from "@/lib/rateLimit";

/**
 * Production liveness, for .github/workflows/monitor.yml.
 *
 * Answering at all proves Vercel is serving the app; the query proves the app
 * can reach Postgres with the credentials it has. Both failed in September
 * 2026 without anyone being told — a code/schema split left /budget throwing
 * for five days, then a password rotation that reached GitHub but not Vercel
 * took every signed-in page down. Nothing probed the database on a schedule,
 * so both were found by a person loading a page.
 *
 * Bearer-gated behind CRON_SECRET, like the cron job, so it is not a free
 * anonymous round trip to the database for anyone who finds the URL.
 */

// Node, not edge: Prisma needs it.
export const runtime = "nodejs";
// Never cached — a cached 200 would defeat the point.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!await withinRateLimit("health", await clientIp())) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  if (!isAuthorizedBearer(request, emailEnv.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    // The reason stays server-side: the 503 is the signal, the Vercel log has
    // the detail, and a public body that named the failure would tell an
    // attacker more than it tells the monitor.
    log.error("Health check: database unreachable", { err: error });
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
