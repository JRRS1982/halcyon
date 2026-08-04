// Idle and absolute session limits. Supabase's own session controls
// (Auth → Sessions: inactivity timeout, time-box) are Pro-plan only, so the app
// implements them: an activity cookie records when the session started and when
// it was last seen, and `src/lib/supabase/middleware.ts` re-evaluates it on
// every request.
//
// The cookie is deliberately unsigned. Forging it can only extend the forger's
// own session, and they already hold the refresh token that grants it — there
// is nothing to gain and nothing to protect. It is httpOnly only to keep it out
// of reach of page scripts.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export const ACTIVITY_COOKIE = "bm_activity";

export type SessionTimeoutConfig = {
  // No requests for this long signs the session out.
  idleMs: number;
  // Hard cap on total session age, however active the user has been.
  absoluteMs: number;
  // How long before idle expiry the client warns the user.
  warnMs: number;
};

export const SESSION_TIMEOUT: SessionTimeoutConfig = {
  idleMs: 6 * HOUR,
  absoluteMs: 24 * HOUR,
  warnMs: 60 * SECOND,
};

export type SessionActivity = {
  startedAt: number;
  lastSeenAt: number;
};

export type SessionStatus =
  | { status: "active" }
  | { status: "expired"; reason: "idle" | "absolute" };

// Cookie payload is "<startedAt>.<lastSeenAt>" in epoch milliseconds — cheaper
// to read and write than JSON, and there is nothing else to carry.
export const serializeActivity = ({
  startedAt,
  lastSeenAt,
}: SessionActivity): string => `${startedAt}.${lastSeenAt}`;

const isTimestamp = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

// Returns null for anything unreadable — a missing cookie, a truncated value, a
// hand-edited one. Callers treat null as "no history", not as an expiry.
export const parseActivity = (raw: unknown): SessionActivity | null => {
  if (typeof raw !== "string") return null;

  const parts = raw.split(".");
  if (parts.length !== 2) return null;

  const startedAt = Number(parts[0]);
  const lastSeenAt = Number(parts[1]);
  if (!isTimestamp(startedAt) || !isTimestamp(lastSeenAt)) return null;
  if (lastSeenAt < startedAt) return null;

  return { startedAt, lastSeenAt };
};

// The activity to write back on a request that is staying signed in. A session
// with no readable history starts its clock now.
export const nextActivity = (
  activity: SessionActivity | null,
  now: number,
): SessionActivity =>
  activity === null
    ? { startedAt: now, lastSeenAt: now }
    : { ...activity, lastSeenAt: now };

export type IdleState =
  | { phase: "active" }
  | { phase: "warning"; secondsRemaining: number }
  | { phase: "expired" };

// The client half of the same limits, decided from wall-clock timestamps rather
// than accumulated ticks so that a suspended laptop wakes up knowing the
// session already lapsed. `useIdleTimer` is a thin shell over this.
export const idleStateAt = (
  lastActivityAt: number,
  now: number,
  config: SessionTimeoutConfig = SESSION_TIMEOUT,
): IdleState => {
  const remainingMs = lastActivityAt + config.idleMs - now;
  if (remainingMs <= 0) return { phase: "expired" };
  if (remainingMs > config.warnMs) return { phase: "active" };

  return { phase: "warning", secondsRemaining: Math.ceil(remainingMs / 1000) };
};

// A missing or unreadable cookie counts as active, not expired. Treating it as
// expired would loop forever for any client that cannot store the cookie, and
// the downside is only that clearing one cookie restarts your own clock.
export const evaluateSession = (
  activity: SessionActivity | null,
  now: number,
  config: SessionTimeoutConfig = SESSION_TIMEOUT,
): SessionStatus => {
  if (activity === null) return { status: "active" };
  if (now - activity.startedAt >= config.absoluteMs)
    return { status: "expired", reason: "absolute" };
  if (now - activity.lastSeenAt >= config.idleMs)
    return { status: "expired", reason: "idle" };

  return { status: "active" };
};
