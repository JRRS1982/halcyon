import { CURRENCY_CODES, CURRENCY_META } from "@/lib/settings/currency";
import { getCurrentUserSettings } from "@/lib/settings/server";
import { SettingsForm } from "./SettingsForm";
import { updateSettings } from "./actions";

// Protected by middleware → /sign-in?next=/settings if no session.
export default async function SettingsPage() {
  const { currency } = await getCurrentUserSettings();

  const currencyOptions = CURRENCY_CODES.map((code) => ({
    code,
    label: `${CURRENCY_META[code].symbol} ${code} · ${CURRENCY_META[code].name}`,
  }));

  return (
    <SettingsForm
      action={updateSettings}
      currency={currency}
      currencyOptions={currencyOptions}
    />
  );
}
