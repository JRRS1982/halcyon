// Liveness for the deployed app: is this instance serving, and can it reach
// the database?
//
// The smoke suite asserts on this after every production deployment. It
// replaced probing /api/unsubscribe with a bogus token, which worked only as a
// side effect of that endpoint happening to touch the database — the day
// someone short-circuits it, the probe silently stops probing and stays green.

export type HealthReport = {
  status: "ok" | "degraded";
  db: "ok" | "error";
};

type Options = {
  /** How long one probe's answer stands for. */
  ttlMs: number;
  now: () => number;
};

// Returns a reader that probes at most once per window.
//
// The cache is the whole protection here: this endpoint is public and
// unauthenticated, so a query per request would let anyone turn a curl loop
// into database load. One probe per window bounds that to a constant, without
// needing per-IP state or the Redis the auth limiter depends on — and unlike
// that limiter, it cannot fail open, because there is nothing to fail.
//
// Failures are cached on the same terms. Caching only successes would mean an
// outage is exactly when the endpoint starts probing on every request, which is
// the worst possible moment for it.
export function createHealthReader(
  probe: () => Promise<unknown>,
  { ttlMs, now }: Options,
): () => Promise<HealthReport> {
  let cached: { report: HealthReport; at: number } | null = null;

  return async () => {
    if (cached && now() - cached.at < ttlMs) return cached.report;

    // Deliberately no error detail, here or anywhere downstream: a driver
    // error names hosts, ports, roles and sometimes credentials, and this body
    // is readable by anyone. The detail belongs in the server log.
    const report: HealthReport = await probe().then(
      () => ({ status: "ok", db: "ok" }) as const,
      () => ({ status: "degraded", db: "error" }) as const,
    );

    cached = { report, at: now() };
    return report;
  };
}
