import { PrismaClient, UserStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

const main = async () => {
  console.log("🌱 Seeding database...");

  if (process.env.NODE_ENV === "production") {
    throw new Error("Cannot seed production database");
  }

  // Clear existing data
  await prisma.user.deleteMany({});

  // Create test users
  const password = await hash("password123", 12);
  const now = new Date();

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: "admin@example.com",
        emailVerified: now,
        name: "Admin User",
        username: "admin",
        password,
        timezone: "Europe/London",
        status: UserStatus.ACTIVE,
        lastLogin: now,
        lastActiveAt: now,
        failedLoginAttempts: 0,
        passwordChangedAt: now,
      },
    }),
    prisma.user.create({
      data: {
        email: "user@example.com",
        emailVerified: now,
        name: "Regular User",
        username: "user",
        password,
        timezone: "America/New_York",
        status: UserStatus.ACTIVE,
        lastLogin: now,
        lastActiveAt: now,
        failedLoginAttempts: 0,
        passwordChangedAt: now,
      },
    }),
  ]);

  console.log(`✅ Seeded ${users.length} users`);
  console.log("👤 Test user credentials:");
  console.log("   Email: admin@example.com");
  console.log("   Password: password123");
};

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
