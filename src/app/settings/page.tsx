import {
  CURRENCY_CODES,
  CURRENCY_META,
  NUMBER_FORMATS,
  NUMBER_FORMAT_SPEC,
  symbolFor,
} from "@/lib/settings/currency";
import { getCurrentUserSettings } from "@/lib/settings/server";
import { SettingsForm } from "./SettingsForm";
import { updateSettings } from "./actions";

// Human labels for each number-format preset (the structural description; the
// live example is appended with the user's currency symbol below).
const NUMBER_FORMAT_LABELS: Record<(typeof NUMBER_FORMATS)[number], string> = {
  COMMA_0: "Comma thousands, no decimals",
  COMMA_2: "Comma thousands, 2 decimals",
  DOT_0: "Dot thousands, no decimals",
  DOT_2: "Dot thousands, 2 decimals",
  SPACE_0: "Space thousands, no decimals",
  SPACE_2: "Space thousands, 2 decimals",
};

// Protected by middleware → /sign-in?next=/settings if no session.
export default async function SettingsPage() {
  const { currency, numberFormat } = await getCurrentUserSettings();
  const symbol = symbolFor(currency);

  const currencyOptions = CURRENCY_CODES.map((code) => ({
    value: code,
    label: `${CURRENCY_META[code].symbol} ${code} · ${CURRENCY_META[code].name}`,
  }));

  const numberFormatOptions = NUMBER_FORMATS.map((fmt) => ({
    value: fmt,
    label: `${symbol}${NUMBER_FORMAT_SPEC[fmt].example} · ${NUMBER_FORMAT_LABELS[fmt]}`,
  }));

  return (
    <SettingsForm
      action={updateSettings}
      currency={currency}
      currencyOptions={currencyOptions}
      numberFormat={numberFormat}
      numberFormatOptions={numberFormatOptions}
    />
  );
}
