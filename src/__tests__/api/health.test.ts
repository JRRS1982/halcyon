/** @jest-environment node */

jest.mock("@/lib/env", () => ({
  emailEnv: { CRON_SECRET: "cron-test-secret" },
}));

jest.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: jest.fn() } }));
jest.mock("@/lib/log", () => ({ log: { error: jest.fn() } }));
jest.mock("@/lib/rateLimit", () => ({ checkRateLimit: jest.fn() }));
jest.mock("@/lib/http/clientIp", () => ({ clientIp: jest.fn() }));

import { GET } from "@/app/api/health/route";
import { clientIp } from "@/lib/http/clientIp";
import { log } from "@/lib/log";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";

const queryRaw = prisma.$queryRaw as jest.Mock;
const logError = log.error as jest.Mock;
const mockCheckRateLimit = checkRateLimit as jest.Mock;
const mockClientIp = clientIp as jest.Mock;

const call = (authorization?: string) =>
  GET(
    new Request("https://example.test/api/health", {
      headers: authorization ? { authorization } : {},
    }),
  );

beforeEach(() => {
  queryRaw.mockReset();
  logError.mockReset();
  mockClientIp.mockResolvedValue("1.2.3.4");
  mockCheckRateLimit.mockResolvedValue("allowed");
});

describe("GET /api/health", () => {
  test("429 when rate limit exceeded, and never touches the database", async () => {
    mockCheckRateLimit.mockResolvedValueOnce("limited");

    const response = await call("Bearer cron-test-secret");

    expect(response.status).toBe(429);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  test("401 without the bearer, and never touches the database", async () => {
    const response = await call();

    expect(response.status).toBe(401);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  test("401 with the wrong bearer", async () => {
    const response = await call("Bearer wrong");

    expect(response.status).toBe(401);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  test("200 {ok:true} when the database answers", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await call("Bearer cron-test-secret");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  // The whole reason the route exists: bad credentials, a paused project or an
  // unreachable pooler must come back as a 503 the monitor can act on — and
  // the *reason* must stay in the server log, not the public body.
  test("503 {ok:false} when the database does not, with the cause logged", async () => {
    const failure = new Error("password authentication failed");
    queryRaw.mockRejectedValueOnce(failure);

    const response = await call("Bearer cron-test-secret");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(logError).toHaveBeenCalledWith(
      "Health check: database unreachable",
      { err: failure },
    );
  });
});
