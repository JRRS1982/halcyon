import { cookies } from "next/headers";
import {
  ACTIVITY_COOKIE,
  activityCookieOptions,
  nextActivity,
  serializeActivity,
} from "./sessionTimeout";

/**
 * Starts the session-timeout clock at the moment a session is created.
 *
 * The proxy treats an authenticated request carrying no readable activity
 * cookie as expired, so every path that mints a session has to seed one or the
 * user is signed straight back out. Two do: the password form (which redirects
 * via a client navigation, so no document request would otherwise write the
 * cookie) and the auth callback that handles OAuth, email confirmation and
 * magic links.
 *
 * Shared rather than duplicated because the two must agree: a seed written
 * with different options or a different shape is the same lockout.
 */
export const startActivityClock = async (
  now: number = Date.now(),
): Promise<void> => {
  const jar = await cookies();
  jar.set(
    ACTIVITY_COOKIE,
    serializeActivity(nextActivity(null, now)),
    activityCookieOptions,
  );
};
