import { darkPalette, lightPalette, paletteToCss } from "./palette";

/**
 * How a user's stored preference is expressed.
 *
 * "SYSTEM" writes no attribute at all, which is what lets the media query below
 * do the deciding — so a user who has never touched the setting follows their
 * OS, and follows it live when they change it, without the app having to
 * listen for anything.
 */
export type ThemePreference = "SYSTEM" | "LIGHT" | "DARK";

export const themeAttribute = (
  preference: ThemePreference,
): "light" | "dark" | undefined => {
  if (preference === "LIGHT") return "light";
  if (preference === "DARK") return "dark";
  return undefined;
};

/**
 * The stylesheet backing every colour token, generated from the palettes so
 * there is one source of truth rather than a hand-maintained copy that drifts.
 *
 * Three rules, and the order matters:
 *
 *   1. light values on :root — the default.
 *   2. dark values when the OS asks for dark, *unless* the user has explicitly
 *      chosen light. The :not() is what makes an explicit choice beat the OS.
 *   3. dark values when the user has explicitly chosen dark.
 *
 * `color-scheme` comes along for the ride so form controls, scrollbars and the
 * browser's own UI match the page instead of staying stubbornly light.
 *
 * This is injected into <head> by the root layout rather than being imported as
 * a CSS file, so the variables are present before first paint and the server
 * can pick the scheme.
 */
export const themeCss = `
:root {
  color-scheme: light;
${paletteToCss(lightPalette)}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
${paletteToCss(darkPalette)}
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;
${paletteToCss(darkPalette)}
}
`.trim();
