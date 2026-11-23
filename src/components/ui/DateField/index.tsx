"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import {
  type DateParts,
  isoFromParts,
  partsFromIso,
} from "@/lib/date/dateParts";
import {
  DATE_FORMAT_SPEC,
  type DateFormat,
  type DatePart,
} from "@/lib/settings/dateFormat";
import {
  Group,
  HiddenDateInput,
  Legend,
  Part,
  PartInput,
  PartName,
  PickerButton,
  Row,
  Separator,
} from "./DateField.styled";
import { useDateFormat } from "./format";

export { DateFormatProvider, useDateFormat } from "./format";

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

const PART_META: Record<
  DatePart,
  { name: string; placeholder: string; size: number }
> = {
  day: { name: "Day", placeholder: "DD", size: 2 },
  month: { name: "Month", placeholder: "MM", size: 2 },
  year: { name: "Year", placeholder: "YYYY", size: 4 },
};

const BIRTHDAY_AUTOCOMPLETE: Record<DatePart, string> = {
  day: "bday-day",
  month: "bday-month",
  year: "bday-year",
};

/**
 * A date as three typed parts (day, month, year) on one field, in the order
 * the user picked in Settings → Format.
 *
 * Not `<input type="date">`: that renders its text and its calendar from the
 * browser's language, so a UK user on a US-language browser reads mm/dd/yyyy
 * and there is no attribute, prop or stylesheet that changes it. Three
 * labelled parts state the order instead of depending on a setting we do not
 * control, and typing "1986" beats scrolling a calendar back forty years. The
 * calendar is still there, behind the button, for anyone who wants it.
 *
 * `onCommit` receives `YYYY-MM-DD`, or "" while the parts do not yet describe
 * a real date. Callers decide what "" means: the create-plan form leaves its
 * button disabled, the assumptions panel simply does not save. `onClear`, when
 * given, fires once all three parts are empty, for a date that may be unset.
 */
export function DateField({
  legend,
  value,
  onCommit,
  onClear,
  required,
  standalone,
  wide = standalone,
  birthday,
  format: formatOverride,
}: {
  legend: string;
  value: string;
  onCommit: (iso: string) => void;
  onClear?: () => void;
  required?: boolean;
  /**
   * The field is the whole point of its card, rather than one of a form of
   * them: full width at a 44px touch height, under a form label.
   */
  standalone?: boolean;
  /** Full width under a form label at a field's height, as in a drawer. */
  wide?: boolean;
  /** A date of birth: lets the browser offer to fill it in. */
  birthday?: boolean;
  /** Overrides the user's setting; for the settings preview and tests. */
  format?: DateFormat;
}) {
  const userFormat = useDateFormat();
  const format = formatOverride ?? userFormat;
  const { order, separator } = DATE_FORMAT_SPEC[format];

  const [parts, setParts] = useState<DateParts>(() => partsFromIso(value));
  const groupRef = useRef<HTMLFieldSetElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const inputRefs = useRef<Partial<Record<DatePart, HTMLInputElement | null>>>(
    {},
  );
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
    if (onClear && !next.day && !next.month && !next.year) {
      onClear();
      return;
    }
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

  // Digits only, and no longer than the part holds — so a stray keystroke
  // cannot push "1986" to "19867" and silently blank the date.
  const digits = (raw: string, max: number) =>
    raw.replace(/\D/g, "").slice(0, max);

  // Filling a part moves to the next, in the user's order: typing 09 07 1982
  // straight through beats reaching for Tab twice in the middle of a date.
  // Only on the way up — deleting back a digit must not fling the caret
  // forward, which would make correcting a typo impossible.
  const onPartChange = (part: DatePart, raw: string) => {
    const { size } = PART_META[part];
    const nextValue = digits(raw, size);
    const previous = parts[part];
    update({ ...parts, [part]: nextValue });
    const following = order[order.indexOf(part) + 1];
    if (following && nextValue.length === size && previous.length < size) {
      inputRefs.current[following]?.focus();
    }
  };

  return (
    <Group ref={groupRef}>
      <Legend $wide={wide}>{legend}</Legend>
      <Row $wide={wide} $standalone={standalone} data-date-row>
        {order.map((part, index) => {
          const meta = PART_META[part];
          return (
            <Fragment key={part}>
              {index > 0 && (
                <Separator aria-hidden="true">{separator}</Separator>
              )}
              <Part htmlFor={`${ids}-${part}`}>
                <PartName>{meta.name}</PartName>
                <PartInput
                  $standalone={standalone}
                  $wide={part === "year"}
                  ref={(el) => {
                    inputRefs.current[part] = el;
                  }}
                  id={`${ids}-${part}`}
                  inputMode="numeric"
                  autoComplete={birthday ? BIRTHDAY_AUTOCOMPLETE[part] : "off"}
                  placeholder={meta.placeholder}
                  required={required}
                  value={parts[part]}
                  onChange={(e) => onPartChange(part, e.target.value)}
                />
              </Part>
            </Fragment>
          );
        })}
        <PickerButton
          type="button"
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
