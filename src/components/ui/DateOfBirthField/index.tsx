"use client";

import { type RefObject, useEffect, useId, useRef, useState } from "react";
import {
  type DateParts,
  isoFromParts,
  partsFromIso,
} from "@/lib/date/dateParts";
import {
  Group,
  HiddenDateInput,
  Legend,
  Part,
  PartInput,
  PartName,
  PickerButton,
  Row,
} from "./DateOfBirthField.styled";

// A legend does not take part in flex or grid layout, so the fieldset stays a
// plain block and the three fields sit in a row of their own inside it.
function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="3.5" width="13" height="12" rx="1.5" />
      <line x1="2.5" y1="7" x2="15.5" y2="7" />
      <line x1="6" y1="1.5" x2="6" y2="4" />
      <line x1="12" y1="1.5" x2="12" y2="4" />
    </svg>
  );
}

/**
 * A date of birth as three fields, in day-month-year order.
 *
 * Not `<input type="date">`: that renders its text and its calendar from the
 * browser's locale, so a UK user on a US-locale browser reads mm/dd/yyyy and
 * there is no attribute, prop or stylesheet that changes it. Three labelled
 * fields state the order instead of depending on a setting we do not control —
 * and typing "1986" beats scrolling a calendar back forty years, which is the
 * other half of why the native control is wrong for a birth date.
 *
 * `onCommit` receives `YYYY-MM-DD`, or "" while the fields do not yet describe
 * a real date. Callers decide what "" means: the create form leaves its button
 * disabled, the assumptions panel simply does not save.
 */
export function DateOfBirthField({
  legend,
  value,
  onCommit,
  required,
  standalone,
}: {
  legend: string;
  value: string;
  onCommit: (iso: string) => void;
  required?: boolean;
  /**
   * The field is the whole point of its card, rather than one of a panel of
   * them: centred, with a larger legend and larger boxes. Off by default, so
   * the group stays inside a dense grid's column and matches the labels
   * beside it.
   */
  standalone?: boolean;
}) {
  const [parts, setParts] = useState<DateParts>(() => partsFromIso(value));
  const groupRef = useRef<HTMLFieldSetElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const ids = useId();

  // Adopt `value` from outside — but never over someone's typing.
  //
  // The assumptions panel saves to the server and re-renders with what it last
  // committed, which arrives a save behind whatever is now in the fields.
  // Comparing against the last value we sent is not enough here: each keystroke
  // moves that on, so an echo of an *earlier* keystroke matches nothing and
  // gets adopted, deleting the correction being typed. Focus is the honest
  // test — if the user is in these fields, the fields are the truth.
  useEffect(() => {
    if (groupRef.current?.contains(document.activeElement)) return;
    setParts(partsFromIso(value));
  }, [value]);

  const update = (next: DateParts) => {
    setParts(next);
    onCommit(isoFromParts(next));
  };

  // showPicker() opens the calendar without showing the input. Where it is
  // missing, focusing the input is the next best thing — some browsers open
  // the calendar on focus, and the ones that do not still leave the three
  // fields, which are the primary way in rather than a fallback.
  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  };

  // Digits only, and no longer than the field holds — so a stray keystroke
  // cannot push "1986" to "19867" and silently blank the date.
  const digits = (raw: string, max: number) =>
    raw.replace(/\D/g, "").slice(0, max);

  // Filling a field moves to the next: typing 09 07 1982 straight through
  // beats reaching for Tab twice in the middle of a date. Only on the way up —
  // deleting back to one digit must not fling the caret forward, which would
  // make correcting a typo impossible.
  const advanceWhenFull = (
    next: string,
    previous: string,
    to: RefObject<HTMLInputElement | null>,
  ) => {
    if (next.length === 2 && previous.length < 2) to.current?.focus();
  };

  return (
    <Group ref={groupRef}>
      <Legend $standalone={standalone}>{legend}</Legend>
      <Row $standalone={standalone}>
        <Part htmlFor={`${ids}-day`}>
          <PartName>Day</PartName>
          <PartInput
            $standalone={standalone}
            id={`${ids}-day`}
            inputMode="numeric"
            autoComplete="bday-day"
            placeholder="DD"
            required={required}
            value={parts.day}
            onChange={(e) => {
              const day = digits(e.target.value, 2);
              update({ ...parts, day });
              advanceWhenFull(day, parts.day, monthRef);
            }}
          />
        </Part>
        <Part htmlFor={`${ids}-month`}>
          <PartName>Month</PartName>
          <PartInput
            $standalone={standalone}
            ref={monthRef}
            id={`${ids}-month`}
            inputMode="numeric"
            autoComplete="bday-month"
            placeholder="MM"
            required={required}
            value={parts.month}
            onChange={(e) => {
              const month = digits(e.target.value, 2);
              update({ ...parts, month });
              advanceWhenFull(month, parts.month, yearRef);
            }}
          />
        </Part>
        <Part htmlFor={`${ids}-year`}>
          <PartName>Year</PartName>
          <PartInput
            $standalone={standalone}
            $wide
            ref={yearRef}
            id={`${ids}-year`}
            inputMode="numeric"
            autoComplete="bday-year"
            placeholder="YYYY"
            required={required}
            value={parts.year}
            onChange={(e) =>
              update({ ...parts, year: digits(e.target.value, 4) })
            }
          />
        </Part>
        <PickerButton
          type="button"
          $standalone={standalone}
          onClick={openPicker}
          aria-label="Choose the date from a calendar"
        >
          <CalendarIcon />
        </PickerButton>
        <HiddenDateInput
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={isoFromParts(parts)}
          onChange={(e) => update(partsFromIso(e.target.value))}
        />
      </Row>
    </Group>
  );
}
