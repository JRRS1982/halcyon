import { clientIp } from "@/lib/http/clientIp";
import { log } from "@/lib/log";
import { checkRateLimit } from "@/lib/rateLimit";
import { incrementWindow } from "@/lib/rateLimit/redis";
import { parseCspReport } from "@/lib/site/cspReport";

/**
 * Where browsers send Content-Security-Policy violation reports.
 *
 * The policy is report-only for now (see next.config.mjs): nothing is blocked,
 * and these reports say what *would* have been. Each one adds to a count in
 * Upstash under `csp:<directive>:<blocked host>`, kept for 30 days from its
 * first sighting — Vercel's runtime logs expire long before a trial ends.
 * Read the counts in the Upstash console's Data Browser.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Real reports are a few hundred bytes; anything far larger is not one.
const MAX_BODY_BYTES = 16_384;
const KEEP_SECONDS = 30 * 24 * 60 * 60;

const empty = (status: number) => new Response(null, { status });

export async function POST(request: Request) {
  if ((await checkRateLimit("csp-report", await clientIp())) !== "allowed") {
    return empty(429);
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return empty(413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return empty(400);
  }

  const violations = parseCspReport(body);
  if (violations.length === 0) return empty(400);

  for (const violation of violations) {
    log.warn("CSP violation (report-only)", violation);
    await incrementWindow(
      `csp:${violation.directive}:${violation.blocked}`,
      KEEP_SECONDS,
    ).catch((err: unknown) => {
      log.error("CSP report not counted", { err });
    });
  }

  return empty(204);
}
