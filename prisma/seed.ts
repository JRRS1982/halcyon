import { PrismaClient, UserStatus } from "@prisma/client";

// Seed local development with profile rows.
//
// Under Supabase Auth, passwords and auth.users rows are managed by Supabase —
// this script does NOT create loginable users. It seeds the application's
// `public.User` profile rows only, so the app has something to render against
// during UI work.
//
// To seed real loginable users (when sign-in/sign-up routes are wired):
//   1. Add @supabase/supabase-js to dependencies.
//   2. Initialise a Supabase admin client with SUPABASE_SECRET_KEY.
//   3. For each test user, call:
//        await supabase.auth.admin.createUser({
//          email: "...",
//          password: "...",
//          email_confirm: true,
//        });
//      Then upsert a matching User profile row with `id` equal to the returned
//      auth user's id.

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Deterministic uuids so seeded data is stable across runs.
const TEST_USERS = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Admin User",
    username: "admin",
    timezone: "Europe/London",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Regular User",
    username: "user",
    timezone: "America/New_York",
  },
];

const main = async () => {
  console.log("🌱 Seeding database...");

  if (process.env.NODE_ENV === "production") {
    throw new Error("Cannot seed production database");
  }

  await prisma.user.deleteMany({});

  const now = new Date();
  const users = await Promise.all(
    TEST_USERS.map((user) =>
      prisma.user.create({
        data: {
          ...user,
          status: UserStatus.ACTIVE,
          lastActiveAt: now,
        },
      }),
    ),
  );

  console.log(`✅ Seeded ${users.length} profile rows`);
  console.log(
    "ℹ️  These profile rows have no matching auth.users entries — they cannot sign in.",
  );
  console.log(
    "   When auth is wired, switch to Supabase Admin API seeding (see top of file).",
  );
};

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
