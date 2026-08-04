import {
  type SessionActivity,
  type SessionTimeoutConfig,
  evaluateSession,
  idleStateAt,
  nextActivity,
  parseActivity,
  serializeActivity,
} from "./sessionTimeout";

const NOW = 1_800_000_000_000;

const config: SessionTimeoutConfig = {
  idleMs: 1000,
  absoluteMs: 10_000,
  warnMs: 100,
};

describe("serializeActivity", () => {
  it("writes '<startedAt>.<lastSeenAt>'", () => {
    expect(serializeActivity({ startedAt: 1, lastSeenAt: 2 })).toBe("1.2");
  });

  it("round-trips through parseActivity", () => {
    const activity: SessionActivity = {
      startedAt: NOW - 5000,
      lastSeenAt: NOW,
    };
    expect(parseActivity(serializeActivity(activity))).toEqual(activity);
  });
});

describe("parseActivity", () => {
  it("reads a well-formed value", () => {
    expect(parseActivity("100.200")).toEqual({
      startedAt: 100,
      lastSeenAt: 200,
    });
  });

  it.each([
    [undefined, "missing cookie"],
    [null, "null"],
    [42, "non-string"],
    ["", "empty"],
    ["100", "one part"],
    ["100.200.300", "three parts"],
    ["abc.200", "non-numeric start"],
    ["100.abc", "non-numeric lastSeen"],
    ["-100.200", "negative start"],
    ["100.-200", "negative lastSeen"],
    ["0.200", "zero start"],
    ["Infinity.200", "non-finite"],
    ["200.100", "lastSeen before start"],
  ])("returns null for %p (%s)", (raw, _reason) => {
    expect(parseActivity(raw)).toBeNull();
  });
});

describe("nextActivity", () => {
  it("starts the clock when there is no history", () => {
    expect(nextActivity(null, NOW)).toEqual({
      startedAt: NOW,
      lastSeenAt: NOW,
    });
  });

  it("advances lastSeenAt and preserves startedAt", () => {
    const activity = { startedAt: NOW - 5000, lastSeenAt: NOW - 1000 };
    expect(nextActivity(activity, NOW)).toEqual({
      startedAt: NOW - 5000,
      lastSeenAt: NOW,
    });
  });

  it("does not mutate its input", () => {
    const activity = { startedAt: NOW, lastSeenAt: NOW };
    nextActivity(activity, NOW + 1000);
    expect(activity.lastSeenAt).toBe(NOW);
  });
});

describe("evaluateSession", () => {
  it("treats a missing cookie as active rather than expired", () => {
    expect(evaluateSession(null, NOW, config)).toEqual({ status: "active" });
  });

  it("is active within both windows", () => {
    const activity = { startedAt: NOW - 5000, lastSeenAt: NOW - 500 };
    expect(evaluateSession(activity, NOW, config)).toEqual({
      status: "active",
    });
  });

  it("expires on idle once lastSeenAt is older than idleMs", () => {
    const activity = { startedAt: NOW - 5000, lastSeenAt: NOW - 1000 };
    expect(evaluateSession(activity, NOW, config)).toEqual({
      status: "expired",
      reason: "idle",
    });
  });

  it("stays active one millisecond before idle expiry", () => {
    const activity = { startedAt: NOW - 5000, lastSeenAt: NOW - 999 };
    expect(evaluateSession(activity, NOW, config)).toEqual({
      status: "active",
    });
  });

  it("expires on the absolute cap even when activity is current", () => {
    const activity = { startedAt: NOW - 10_000, lastSeenAt: NOW };
    expect(evaluateSession(activity, NOW, config)).toEqual({
      status: "expired",
      reason: "absolute",
    });
  });

  it("reports the absolute cap when both windows have elapsed", () => {
    const activity = { startedAt: NOW - 20_000, lastSeenAt: NOW - 20_000 };
    expect(evaluateSession(activity, NOW, config)).toEqual({
      status: "expired",
      reason: "absolute",
    });
  });

  it("stays active when the clock skews backwards", () => {
    const activity = { startedAt: NOW + 5000, lastSeenAt: NOW + 5000 };
    expect(evaluateSession(activity, NOW, config)).toEqual({
      status: "active",
    });
  });
});

describe("idleStateAt", () => {
  it("is active well inside the idle window", () => {
    expect(idleStateAt(NOW - 500, NOW, config)).toEqual({ phase: "active" });
  });

  it("is active while remaining time is above the warning threshold", () => {
    expect(idleStateAt(NOW - 899, NOW, config)).toEqual({ phase: "active" });
  });

  it("warns once remaining time reaches the warning threshold", () => {
    expect(idleStateAt(NOW - 900, NOW, config)).toEqual({
      phase: "warning",
      secondsRemaining: 1,
    });
  });

  it("rounds the countdown up so it never shows a premature zero", () => {
    expect(idleStateAt(NOW - 950, NOW, config)).toEqual({
      phase: "warning",
      secondsRemaining: 1,
    });
  });

  it("expires exactly on the idle boundary", () => {
    expect(idleStateAt(NOW - 1000, NOW, config)).toEqual({ phase: "expired" });
  });

  it("expires after a long suspend rather than resuming mid-countdown", () => {
    expect(idleStateAt(NOW - 8 * 60 * 60 * 1000, NOW, config)).toEqual({
      phase: "expired",
    });
  });
});
