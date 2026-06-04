import { Prisma } from "@prisma/client";

// Serialises an export payload to JSON. Prisma `Decimal` instances are rendered
// as strings so monetary precision survives a round-trip (a plain Decimal would
// stringify to `{}`); `Date` values already serialise to ISO-8601 via their
// built-in `toJSON`, so no special handling is needed for them.
export function serializeExport(data: unknown): string {
  return JSON.stringify(
    data,
    (_key, value) =>
      value instanceof Prisma.Decimal ? value.toString() : value,
    2,
  );
}
