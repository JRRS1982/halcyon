// Safety net: never let integration tests (which truncate tables) run against
// anything but the test database.
if (!process.env.DATABASE_URL?.includes("halcyon_test")) {
  throw new Error(
    `Integration tests must run against halcyon_test — got DATABASE_URL=${process.env.DATABASE_URL}`,
  );
}

// Mock the boundaries the server actions don't own:
//  - Supabase auth → a fixed signed-in user (id must match TEST_USER_ID).
//  - next/cache + next/navigation → no request context exists under Jest.
jest.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "00000000-0000-0000-0000-0000000000aa",
            email: "test@example.com",
            // A signed-in account really does carry identities, and the app
            // reads them to decide whether to ask for a password or mail a
            // one-time code (src/lib/auth/reauth.ts). Omitting them made this
            // fixture look like a Google-only sign-in.
            identities: [{ provider: "email" }],
            // Likewise confirmed. The app treats an unconfirmed address as
            // signed out (src/lib/auth/confirmed.ts), so a fixture without
            // this looks like someone who never clicked the link in their
            // email and gets redirected out of every action.
            email_confirmed_at: "2026-01-01T00:00:00.000Z",
          },
        },
      }),
      signInWithPassword: async () => ({ error: null }),
    },
  }),
}));

jest.mock("@/lib/http/clientIp", () => ({ clientIp: async () => null }));
jest.mock("@/lib/rateLimit", () => ({
  checkRateLimit: async () => "allowed",
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

// redirect() works by throwing, and `digest` is how the framework tells its
// own control flow apart from a real failure — `unstable_rethrow` reads it to
// let a navigation escape a catch that would otherwise swallow it. A plain
// Error here would be unrecognisable, so an action that catches would report
// the redirect as a failure in the tests while redirecting correctly in
// production. The message stays readable so assertions can keep naming the
// destination.
jest.mock("next/navigation", () => {
  const actual = jest.requireActual("next/navigation");
  return {
    ...actual,
    redirect: (url: string) => {
      const error = new Error(`redirect:${url}`);
      (error as Error & { digest: string }).digest =
        `NEXT_REDIRECT;replace;${url};307;`;
      throw error;
    },
  };
});

import { resetDb, seedUser } from "./helpers";

beforeEach(async () => {
  await resetDb();
  await seedUser();
});
