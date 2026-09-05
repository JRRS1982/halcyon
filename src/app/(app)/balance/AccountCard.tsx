"use client";

import type { AccountKind, AccountSection, AccountType } from "@prisma/client";
import { useState } from "react";
import styled from "styled-components";
import { SelectCell, TextCell } from "@/app/(app)/plan/EditableCell";
import { AccountTermsFields } from "@/components/accounts/AccountTermsFields";
import { Drawer, DrawerSection, Field } from "@/components/ui/Drawer";
import { accountTypesOfKind, termsFor } from "@/lib/accounts/accountDraft";
import type { AccountTermsInput } from "@/lib/accounts/schemas";
import { summariseTerms } from "@/lib/accounts/termsSummary";
import { isValidBalanceCategory } from "@/lib/balance/reorder";
import { accountSectionSchema } from "@/lib/balance/schemas";
import {
  renameAccount,
  setAccountSection,
  setAccountTerms,
  setAccountType,
} from "./accountActions";

// Same wording BalanceSheet.tsx's own subheads use — the card's "Section"
// field should read as the destination the user already sees on the sheet.
const SECTION_LABELS: Record<AccountSection, string> = {
  CURRENT: "Current",
  MEDIUM_TERM: "Medium-term",
  LONG_TERM: "Long-term",
  PROPERTY: "Property",
  OTHER: "Other",
};

const ErrorText = styled.p`
  margin: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.md};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.negative};
`;

export type CardAccount = {
  id: string;
  name: string;
  type: AccountType;
  section: AccountSection;
  kind: AccountKind;
  terms: AccountTermsInput;
};

/**
 * The re-openable card behind a balance-sheet row's name. It owns the
 * account's identity (name, type, section) and its projection parameters
 * (terms) — everything the row itself used to expose through the toolbar's
 * two selects plus the Add drawer's Advanced section, now gathered in one
 * place a click on the row's name reaches.
 *
 * Each field commits through its own server action on blur/change, exactly
 * like the plan's own drawers — a failure reverts only its own cell (the
 * EditableCell family already does this) and this card's own error slot
 * shows the server's sentence verbatim. A refused type change names the
 * linked mortgage or plan event blocking it, and that sentence is the only
 * thing telling the user what to fix — never replaced with a generic
 * "Could not save".
 *
 * Deliberately holds no router: like DeleteAccountPanel, it reports success
 * upward (`onSaved`) rather than refreshing itself, so the sheet decides when
 * and how to adopt the fresh server state.
 */
export function AccountCard({
  open,
  account,
  onClose,
  onSaved,
}: {
  open: boolean;
  account: CardAccount;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const run = async (write: () => Promise<void>) => {
    setError(null);
    try {
      await write();
      onSaved?.();
    } catch (e) {
      // Shown right here, inline, beside the control that caused it — never
      // pushed up to the sheet. Doing so used to duplicate the same sentence
      // in BalanceSheet's own error banner, and the sheet's blanket clear on
      // every successful card write could silently swallow an unrelated
      // background save failure that had nothing to do with this write.
      setError(e instanceof Error ? e.message : "Could not save");
      throw e;
    }
  };

  const typeOptions = accountTypesOfKind(account.kind);
  const typeLabels = typeOptions.reduce<Partial<Record<AccountType, string>>>(
    (labels, option) => {
      labels[option.id] = option.label;
      return labels;
    },
    {},
  );

  const sections = accountSectionSchema.options.filter((section) =>
    isValidBalanceCategory(account.kind, section),
  );

  return (
    <Drawer
      open={open}
      eyebrow="Balance sheet"
      title={account.name}
      onClose={onClose}
    >
      {error ? <ErrorText role="alert">{error}</ErrorText> : null}
      <DrawerSection title="Account" defaultOpen>
        <Field label="Name">
          <TextCell
            value={account.name}
            onCommit={(name) =>
              run(() => renameAccount({ accountId: account.id, name }))
            }
          />
        </Field>
        <Field label="Type">
          <SelectCell
            value={account.type}
            options={typeOptions.map((option) => option.id)}
            labels={typeLabels}
            onCommit={(type) =>
              run(() => setAccountType({ accountId: account.id, type }))
            }
          />
        </Field>
        <Field label="Section">
          <SelectCell
            value={account.section}
            options={sections}
            labels={SECTION_LABELS}
            onCommit={(section) =>
              run(() => setAccountSection({ accountId: account.id, section }))
            }
          />
        </Field>
      </DrawerSection>

      {termsFor(account.type).length > 0 ? (
        <DrawerSection
          title="Advanced"
          defaultOpen
          summary={summariseTerms(account.type, account.terms)}
        >
          <AccountTermsFields
            type={account.type}
            value={account.terms}
            onChange={(terms) =>
              run(() => setAccountTerms({ accountId: account.id, terms }))
            }
          />
        </DrawerSection>
      ) : null}
    </Drawer>
  );
}
