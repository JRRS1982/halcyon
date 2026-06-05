# TypeScript Guidelines

Type-level practices for this codebase. General style (early returns, naming, comments) lives in `code-style.md`; this file is only about types. Biome and `tsc --noEmit` (strict mode) enforce the basics — don't re-state what tooling already catches.

## Core Rules

- Let inference do the work. Annotate exported function signatures and module boundaries; don't annotate locals where the type is obvious from the right-hand side
- Use `unknown`, never `any`, for values of unknown shape (caught errors, parsed JSON, external data). Narrow before use
- No `as` casts except `as const`. To check a value against a type without widening it, use `satisfies`. To narrow at runtime, use a type predicate (`value is X`) or a discriminated union
- Derive types instead of duplicating them:
  - From zod schemas: `z.infer<typeof schema>` (output) / `z.input<typeof schema>` (pre-transform input)
  - From Prisma: use the generated model types and `Prisma.*GetPayload` for queries with `select`/`include`; never hand-write a type that mirrors a model
  - From other types: `Pick`, `Omit`, `Partial`, `ReturnType` rather than copy-pasting fields
- No `enum`. Use an `as const` object (or literal union) and derive the type from it
- Model mutually exclusive states as discriminated unions, not optional-field soups. Switch on the discriminant and use a `never` check for exhaustiveness
- Use `import type` for type-only imports (keeps them erasable; Biome organizes them)
- Prefer `type` aliases over `interface` (matches existing code); use `interface` only when declaration merging is actually needed
- TypeScript types are compile-time only — validate external data (form input, request bodies, env vars, fetched JSON) with zod at the boundary, then trust the inferred type inside
- `noUncheckedIndexedAccess` is not enabled, so `array[i]` and `record[key]` are typed as present even when they may not be — guard index access manually where the index isn't provably valid

## Examples

### `satisfies` over `as`

**Bad (cast hides errors and widens):**

```typescript
const palette = {
  income: "#2e7d32",
  expense: "#c62828",
} as Record<string, string>;

palette.incom; // typo compiles; values widened to string
```

**Good (checked, inference kept):**

```typescript
const palette = {
  income: "#2e7d32",
  expense: "#c62828",
} satisfies Record<string, string>;

palette.income; // autocompleted; typo is a compile error
```

### `as const` instead of `enum`

**Bad:**

```typescript
enum TransactionKind {
  Income = "INCOME",
  Expense = "EXPENSE",
}
```

**Good:**

```typescript
const TRANSACTION_KINDS = ["INCOME", "EXPENSE"] as const;
type TransactionKind = (typeof TRANSACTION_KINDS)[number];
```

### Derive from the zod schema

**Bad (type drifts from the schema):**

```typescript
const importSchema = z.object({ accountId: z.string().uuid(), rows: z.array(rowSchema) });

type ImportInput = {
  accountId: string;
  rows: Row[];
};
```

**Good (always in sync):**

```typescript
const importSchema = z.object({ accountId: z.string().uuid(), rows: z.array(rowSchema) });

type ImportInput = z.input<typeof importSchema>;
```

### Discriminated unions with exhaustive checks

**Bad (impossible states representable):**

```typescript
type ImportState = {
  loading: boolean;
  preview?: ImportPreview;
  error?: string;
};
```

**Good (each state is explicit):**

```typescript
type ImportState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; preview: ImportPreview }
  | { status: "failed"; error: string };

function describe(state: ImportState): string {
  switch (state.status) {
    case "idle":
      return "Waiting for file";
    case "loading":
      return "Parsing…";
    case "ready":
      return `${state.preview.rows.length} rows`;
    case "failed":
      return state.error;
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}
```

### Type predicates for reusable narrowing

```typescript
function isDuplicateRow(row: ImportRow): row is DuplicateRow {
  return "existingTransactionId" in row;
}

const duplicates = rows.filter(isDuplicateRow); // DuplicateRow[]
```
