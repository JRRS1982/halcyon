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
        data: { user: { id: "00000000-0000-0000-0000-0000000000aa" } },
      }),
    },
  }),
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

jest.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

import { resetDb, seedUser } from "./helpers";

beforeEach(async () => {
  await resetDb();
  await seedUser();
});
