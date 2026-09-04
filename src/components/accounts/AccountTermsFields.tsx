"use client";

import type { AccountType } from "@prisma/client";
import { useId } from "react";
import { BoolCell, NumberCell, TextCell } from "@/app/(app)/plan/EditableCell";
import { Field } from "@/components/ui/Drawer";
import { type TermField, termsFor } from "@/lib/accounts/accountDraft";
import type { AccountTermsInput } from "@/lib/accounts/schemas";

// The user's words, not the column's. "Fixed until" is what a mortgage holder
// calls revisionDate; "Paid off by" is what they call endDate — except on a
// final salary pension, where the same column means the day it starts paying.
export const TERM_LABELS: Record<TermField, string> = {
  expectedReturnPct: "Expected growth %",
  feePct: "Platform fee %",
  minAccessAge: "Earliest access age",
  annualIncome: "Pension income /yr",
  interestPct: "Interest rate %",
  interestOnly: "Interest only",
  revisionDate: "Fixed until",
  revisionRate: "Rate after that %",
  endDate: "Paid off by",
};

// What a blank field falls back to, shown as the placeholder so skipping a
// parameter is an informed choice rather than a silent one.
const TERM_PLACEHOLDERS: Record<TermField, string> = {
  expectedReturnPct: "plan default",
  feePct: "0",
  minAccessAge: "57",
  annualIncome: "0",
  interestPct: "0",
  interestOnly: "",
  revisionDate: "",
  revisionRate: "",
  endDate: "never",
};

// A date column round-trips through the input as yyyy-mm-dd; anything else is
// what the browser's date input hands back for a cleared field.
const toDateValue = (value: Date | null | undefined): string =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

/**
 * The projection's parameters for one account, rendered as the fields its type
 * prompts for and nothing else.
 *
 * Controlled and persistence-agnostic on purpose: the balance sheet's Add
 * drawer passes a draft setter (nothing is written until Add), while the
 * re-opened card and the plan's own drawer pass a server action. EditableCell's
 * `onCommit` is typed `Promise<void> | void`, so both are the same callback.
 */
export function AccountTermsFields({
  type,
  value,
  onChange,
}: {
  type: AccountType;
  value: AccountTermsInput;
  onChange: (next: AccountTermsInput) => void;
}) {
  const interestOnlyId = useId();
  const fields = termsFor(type);

  // Never mutates `value` — the Add drawer holds it in state and React would
  // not see an in-place edit.
  const set = <K extends TermField>(key: K, next: AccountTermsInput[K]) =>
    onChange({ ...value, [key]: next });

  // A final salary pension's endDate is the day it starts paying, not the day
  // it is paid off. Same column, different question, chosen by type — exactly
  // as expectedReturnPct means interest on cash and growth on equities.
  const labelFor = (field: TermField): string =>
    field === "endDate" && type === "FINAL_SALARY"
      ? "Starts paying"
      : TERM_LABELS[field];

  return (
    <>
      {fields.map((field) => {
        const label = labelFor(field);
        const placeholder = TERM_PLACEHOLDERS[field];

        if (field === "interestOnly") {
          return (
            <Field key={field} label={label} htmlFor={interestOnlyId}>
              <BoolCell
                id={interestOnlyId}
                value={value.interestOnly ?? false}
                onCommit={(next) => set("interestOnly", next)}
              />
            </Field>
          );
        }

        if (field === "revisionDate" || field === "endDate") {
          return (
            <Field key={field} label={label}>
              <TextCell
                type="date"
                value={toDateValue(value[field])}
                placeholder={placeholder}
                onCommit={(next) =>
                  set(field, next === "" ? null : new Date(next))
                }
              />
            </Field>
          );
        }

        return (
          <Field key={field} label={label}>
            <NumberCell
              value={value[field] ?? null}
              nullable
              step={field === "minAccessAge" ? "1" : "0.01"}
              placeholder={placeholder}
              onCommit={(next) => set(field, next)}
            />
          </Field>
        );
      })}
    </>
  );
}
