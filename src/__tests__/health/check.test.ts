import { createHealthReader } from "@/lib/health/check";

const reader = (
  probe: () => Promise<unknown>,
  clock: { t: number } = { t: 0 },
) => createHealthReader(probe, { ttlMs: 5000, now: () => clock.t });

describe("createHealthReader", () => {
  test("a reachable database reports ok", async () => {
    await expect(reader(async () => 1)()).resolves.toEqual({
      status: "ok",
      db: "ok",
    });
  });

  test("an unreachable database reports degraded rather than throwing", async () => {
    await expect(
      reader(async () => {
        throw new Error("connect ECONNREFUSED 10.0.0.1:5432");
      })(),
    ).resolves.toEqual({ status: "degraded", db: "error" });
  });

  test("the report never carries the underlying error", async () => {
    // This endpoint is public and unauthenticated. A driver error names hosts,
    // ports, roles and sometimes credentials; none of that belongs in a body
    // anyone can curl.
    const report = await reader(async () => {
      throw new Error("password authentication failed for user 'postgres'");
    })();
    expect(JSON.stringify(report)).not.toMatch(/postgres|password|5432/i);
    expect(Object.keys(report).sort()).toEqual(["db", "status"]);
  });

  test("repeat calls inside the window hit the cache, not the database", async () => {
    // An unauthenticated endpoint that queries on every request is an
    // amplification vector; one probe per window bounds it.
    let probes = 0;
    const read = reader(async () => {
      probes++;
    });
    await read();
    await read();
    await read();
    expect(probes).toBe(1);
  });

  test("the cache expires, so recovery is noticed", async () => {
    let probes = 0;
    const clock = { t: 0 };
    const read = reader(async () => {
      probes++;
    }, clock);
    await read();
    clock.t = 4999;
    await read();
    expect(probes).toBe(1);
    clock.t = 5001;
    await read();
    expect(probes).toBe(2);
  });

  test("a failure is cached too, so an outage cannot be used to hammer the pool", async () => {
    let probes = 0;
    const read = reader(async () => {
      probes++;
      throw new Error("down");
    });
    await expect(read()).resolves.toEqual({ status: "degraded", db: "error" });
    await expect(read()).resolves.toEqual({ status: "degraded", db: "error" });
    expect(probes).toBe(1);
  });
});
