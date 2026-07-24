// Runs once when the Next.js server process boots (dev and prod). Importing the
// env module runs its zod parse, so a missing/malformed env var fails the boot
// loudly instead of erroring cryptically mid-request. See ADR-004 and
// src/lib/env.ts.
export const register = async () => {
  await import("@/lib/env");
};
