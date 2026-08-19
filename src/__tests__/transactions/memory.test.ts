// src/__tests__/transactions/memory.test.ts
import { buildCategoryMemory, descriptionKey } from "@/lib/transactions/memory";

describe("descriptionKey", () => {
  test("case, whitespace and punctuation don't split a merchant", () => {
    expect(descriptionKey("TESCO  STORES")).toBe("tesco stores");
    expect(descriptionKey("tesco stores")).toBe("tesco stores");
    expect(descriptionKey("Tesco, Stores.")).toBe("tesco stores");
  });

  test("card-terminal reference numbers don't split a merchant", () => {
    expect(descriptionKey("TESCO STORES 3421")).toBe(
      descriptionKey("TESCO STORES 2211"),
    );
    expect(descriptionKey("PAYPAL *NETFLIX 35314369001")).toBe(
      descriptionKey("PAYPAL *NETFLIX 35319990002"),
    );
  });

  test("a description with no letters yields no key", () => {
    expect(descriptionKey("12345")).toBe("");
    expect(descriptionKey("  --- ")).toBe("");
  });
});

describe("buildCategoryMemory", () => {
  const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  test("remembers the category a description last had", () => {
    const memory = buildCategoryMemory([
      {
        description: "TESCO STORES 1111",
        categoryId: "groceries",
        date: day("2026-06-02"),
      },
      {
        description: "SHELL PETROL",
        categoryId: "travel",
        date: day("2026-06-03"),
      },
    ]);
    expect(memory.get(descriptionKey("TESCO STORES 9999"))).toBe("groceries");
    expect(memory.get(descriptionKey("Shell Petrol"))).toBe("travel");
  });

  test("the most recent categorisation wins when the user changed their mind", () => {
    const memory = buildCategoryMemory([
      {
        description: "AMAZON",
        categoryId: "household",
        date: day("2026-05-01"),
      },
      { description: "AMAZON", categoryId: "gifts", date: day("2026-07-01") },
      {
        description: "AMAZON",
        categoryId: "household",
        date: day("2026-06-01"),
      },
    ]);
    expect(memory.get("amazon")).toBe("gifts");
  });

  test("a keyless description is never remembered", () => {
    const memory = buildCategoryMemory([
      { description: "12345", categoryId: "misc", date: day("2026-06-01") },
    ]);
    expect(memory.size).toBe(0);
  });

  test("an unknown description has no suggestion", () => {
    const memory = buildCategoryMemory([
      {
        description: "TESCO",
        categoryId: "groceries",
        date: day("2026-06-01"),
      },
    ]);
    expect(memory.get(descriptionKey("BRAND NEW PLACE"))).toBeUndefined();
  });
});
