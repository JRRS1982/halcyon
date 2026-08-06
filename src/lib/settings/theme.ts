export const THEME_PREFERENCES = ["SYSTEM", "LIGHT", "DARK"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "SYSTEM";

// The column is plain text (like currency and numberFormat), so anything read
// from it is validated here rather than trusted. An unrecognised value falls
// back to SYSTEM instead of throwing — a bad row should not take the page down.
export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === "string" &&
    (THEME_PREFERENCES as readonly string[]).includes(value)
  );
}

export const THEME_PREFERENCE_LABELS: Record<ThemePreference, string> = {
  SYSTEM: "Match my system",
  LIGHT: "Light",
  DARK: "Dark",
};
