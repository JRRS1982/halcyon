-- New accounts now start with a category taxonomy and a set of accounts (see
-- src/lib/onboarding/defaults.ts, seeded by provisionUserSettings). This fills
-- the same data in for users who signed up before that existed.
--
-- Only for users who have NOTHING: the guard counts every row, including
-- soft-deleted ones, so anyone who has curated a list — or deliberately
-- deleted the lot — is left exactly as they are. That makes the migration
-- safe to run against production, where the alternative (merging by label)
-- would resurrect categories people had removed on purpose.
--
-- Deliberately does NOT touch the budget sheet. New users get the current
-- month pre-filled with £0 rows because their sheet is empty anyway; injecting
-- seventeen zero rows into a live budget month would be vandalism.
--
-- The label list is duplicated from the TypeScript module rather than imported,
-- because a migration is a record of what happened at a point in time. It is
-- expected to drift from the module as the defaults evolve, and must not be
-- edited afterwards.

-- `id` and `updatedAt` are supplied explicitly: Prisma generates both in the
-- client (@default(uuid()) / @updatedAt), so neither has a database default.
INSERT INTO "Category" ("id", "userId", "type", "category", "incomeCategory", "label", "sortOrder", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  u."id",
  d."type"::"ItemType",
  d."category"::"ExpenseCategory",
  d."incomeCategory"::"IncomeCategory",
  d."label",
  d."sortOrder",
  now(),
  now()
FROM "User" u
CROSS JOIN (
  VALUES
    ('INCOME'::text, NULL::text, 'SALARY'::text, 'Salary'::text, 0),
    ('INCOME', NULL, 'SIDE_INCOME', 'Side Income', 1),
    ('INCOME', NULL, 'INVESTMENTS', 'Investment Income', 2),
    ('INCOME', NULL, 'PENSIONS', 'Pension Income', 3),
    ('INCOME', NULL, 'OTHER', 'Benefits & Child Benefit', 4),
    ('INCOME', NULL, 'OTHER', 'Rental Income', 5),
    ('INCOME', NULL, 'OTHER', 'Other Income', 6),
    ('EXPENSE', 'FIXED', NULL, 'Rent / Mortgage', 7),
    ('EXPENSE', 'FIXED', NULL, 'Council Tax', 8),
    ('EXPENSE', 'FIXED', NULL, 'Utilities', 9),
    ('EXPENSE', 'FIXED', NULL, 'Water', 10),
    ('EXPENSE', 'FIXED', NULL, 'Phone & Internet', 11),
    ('EXPENSE', 'FIXED', NULL, 'TV Licence', 12),
    ('EXPENSE', 'FIXED', NULL, 'Insurance', 13),
    ('EXPENSE', 'FIXED', NULL, 'Subscriptions', 14),
    ('EXPENSE', 'FIXED', NULL, 'Childcare', 15),
    ('EXPENSE', 'FIXED', NULL, 'School & Education', 16),
    ('EXPENSE', 'FIXED', NULL, 'Loan Repayments', 17),
    ('EXPENSE', 'VARIABLE', NULL, 'Groceries', 18),
    ('EXPENSE', 'VARIABLE', NULL, 'Household & Cleaning', 19),
    ('EXPENSE', 'VARIABLE', NULL, 'Fuel', 20),
    ('EXPENSE', 'VARIABLE', NULL, 'Public Transport', 21),
    ('EXPENSE', 'VARIABLE', NULL, 'Parking & Tolls', 22),
    ('EXPENSE', 'VARIABLE', NULL, 'Motoring', 23),
    ('EXPENSE', 'VARIABLE', NULL, 'Health & Medical', 24),
    ('EXPENSE', 'VARIABLE', NULL, 'Fitness', 25),
    ('EXPENSE', 'VARIABLE', NULL, 'Home & Maintenance', 26),
    ('EXPENSE', 'VARIABLE', NULL, 'Clothing', 27),
    ('EXPENSE', 'VARIABLE', NULL, 'Personal Care', 28),
    ('EXPENSE', 'VARIABLE', NULL, 'Pets', 29),
    ('EXPENSE', 'VARIABLE', NULL, 'Kids'' Activities', 30),
    ('EXPENSE', 'VARIABLE', NULL, 'Other Expenses', 31),
    ('EXPENSE', 'DISCRETIONARY', NULL, 'Meals Out', 32),
    ('EXPENSE', 'DISCRETIONARY', NULL, 'Takeaways & Fast Food', 33),
    ('EXPENSE', 'DISCRETIONARY', NULL, 'Coffee & Snacks', 34),
    ('EXPENSE', 'DISCRETIONARY', NULL, 'Alcohol', 35),
    ('EXPENSE', 'DISCRETIONARY', NULL, 'Entertainment', 36),
    ('EXPENSE', 'DISCRETIONARY', NULL, 'Hobbies & Sport', 37),
    ('EXPENSE', 'DISCRETIONARY', NULL, 'Holidays', 38),
    ('EXPENSE', 'DISCRETIONARY', NULL, 'Gifts', 39),
    ('EXPENSE', 'DISCRETIONARY', NULL, 'Charity', 40)
) AS d("type", "category", "incomeCategory", "label", "sortOrder")
WHERE NOT EXISTS (
  SELECT 1 FROM "Category" c WHERE c."userId" = u."id"
);

-- Accounts carry no `type`: the Settings form doesn't collect one, so a default
-- with a type set would be a value the user can see but never edit.
INSERT INTO "Account" ("id", "userId", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid(), u."id", d."name", now(), now()
FROM "User" u
CROSS JOIN (
  VALUES
    ('Current Account'::text),
    ('Joint Account'),
    ('Savings Account'),
    ('Emergency Fund Account'),
    ('ISA'),
    ('SIPP')
) AS d("name")
WHERE NOT EXISTS (
  SELECT 1 FROM "Account" a WHERE a."userId" = u."id"
);
