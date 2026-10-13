import { TEST_USER_ID } from "@test/support/helpers";
import { createManagedCategory } from "@/app/(app)/settings/categoryActions";
import { MAX_CATEGORIES_PER_USER } from "@/lib/categories/limits";
import { prisma } from "@/lib/prisma";

const newCategory = {
  label: "One more",
  type: "EXPENSE" as const,
  section: "VARIABLE" as const,
};

async function seedCategories(count: number, deletedAt: Date | null = null) {
  await prisma.category.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      userId: TEST_USER_ID,
      label: `Seeded ${i}`,
      type: "EXPENSE" as const,
      section: "VARIABLE" as const,
      deletedAt,
    })),
  });
}

describe("category cap (integration)", () => {
  it("refuses to create a category once the user is at the ceiling", async () => {
    await seedCategories(MAX_CATEGORIES_PER_USER);

    await expect(createManagedCategory(newCategory)).rejects.toThrow(
      `maximum of ${MAX_CATEGORIES_PER_USER} categories`,
    );

    expect(
      await prisma.category.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(MAX_CATEGORIES_PER_USER);
  });

  // Deleting a category is a soft delete, so counting every row the user has
  // ever had would let a few rounds of tidying up lock the list for good.
  it("does not count deleted categories toward the ceiling", async () => {
    await seedCategories(MAX_CATEGORIES_PER_USER, new Date());

    await createManagedCategory(newCategory);

    expect(
      await prisma.category.count({
        where: { userId: TEST_USER_ID, deletedAt: null },
      }),
    ).toBe(1);
  });
});
