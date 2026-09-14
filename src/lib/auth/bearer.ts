import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time check that `request` carries `Authorization: Bearer <secret>`.
 *
 * An unset secret refuses rather than passes: "no secret configured" must
 * never read as "no authentication required". The length comparison
 * short-circuits before timingSafeEqual, which would otherwise throw on
 * unequal lengths — that leaks length only, which is safe.
 */
export function isAuthorizedBearer(
  request: Request,
  secret: string | undefined,
): boolean {
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
