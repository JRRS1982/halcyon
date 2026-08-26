import type { AccountKind, ItemType } from "@prisma/client";

// The two Account kinds a budget row can anchor to — AccountKind's third
// member, NONE, is a plain transaction account and anchors nothing.
export type AnchorKind = Extract<AccountKind, "ASSET" | "LIABILITY">;

// A TRANSFER funds an asset; a REPAYMENT pays down a liability. INCOME and
// EXPENSE anchor to a category instead and take no account at all.
export function requiredAnchorKind(type: ItemType): AnchorKind | null {
  if (type === "TRANSFER") return "ASSET";
  if (type === "REPAYMENT") return "LIABILITY";
  return null;
}

const ANCHOR_NOUN = {
  ASSET: "an asset",
  LIABILITY: "a liability",
} as const satisfies Record<AnchorKind, string>;

// Throws unless `type` may anchor to an account at all and `kind` is the kind
// it must anchor to. Lives here, not in the action, so the unanchored branch —
// which zod makes unreachable through createItemForMonth — can still be
// tested: a second fence exists for the case where the first is bypassed, so
// it has to hold on its own rather than waving an unexpected kind through.
export function assertAnchorMatches(type: ItemType, kind: AccountKind): void {
  const required = requiredAnchorKind(type);
  if (!required) {
    throw new Error("Only TRANSFER and REPAYMENT anchor to an account");
  }
  if (kind !== required) {
    throw new Error(
      `A ${type} must target ${ANCHOR_NOUN[required]} account, not ${kind.toLowerCase()}`,
    );
  }
}
