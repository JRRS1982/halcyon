// Theme object — the runtime form of DESIGN.md's frontmatter tokens.
// Keep this file in lockstep with /DESIGN.md; if a token here ever drifts
// from the doc, the doc wins and this file is wrong.

export const theme = {
  colors: {
    primary: "#000000",
    onPrimary: "#FFFFFF",
    ink: "#000000",
    inkSoft: "#1B1B1B",
    body: "#525252",
    // bodyMuted and dim carry real text — muted labels, $0 amounts, chart axis
    // ticks — at 11-13px, so both have to clear 4.5:1. They were #8A8A8A
    // (3.45:1) and #999999 (2.85:1), failing the minimum in
    // docs/AccessibilityStandards.md at any size.
    //
    // Sized against canvasSoft, not white: the sheet's header, subtotal and
    // group rows sit on it, so it is the tighter of the two surfaces these
    // greys have to survive. #717171 is the lightest that clears both, which
    // keeps `dim` receding as far as it is allowed to.
    bodyMuted: "#6E6E6E",
    dim: "#717171",
    hairline: "#E5E5E5",
    hairlineStrong: "#D4D4D4",
    hairlineDark: "#1F242C",
    canvas: "#FFFFFF",
    canvasSoft: "#F7F7F7",
    canvasDark: "#0F1116",
    surfaceDarkSoft: "#1A1D23",
    onDark: "#FFFFFF",
    bodyOnDark: "#A8AFBC",
    // Sign colours double as text on amount cells, so they answer to the same
    // 4.5:1 floor. The old green (#1F8A4C) sat at 4.38:1 — near enough to look
    // fine and still fail. Red was already comfortable at 5.8:1.
    positive: "#1A7A43",
    negative: "#B33B3B",
    focus: "#0F1116",
    // The single highlight accent. Used sparingly — period dates in eyebrows,
    // selected rows, anything the user should locate at a glance.
    accent: "#1E5BC6",
  },

  // Five sizes only. See DESIGN.md → Typography → Hierarchy.
  typography: {
    displayXl: {
      family:
        "Inter, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
      size: "28px",
      weight: 500,
      lineHeight: 1.1,
      letterSpacing: "-0.02em",
    },
    displayLg: {
      family:
        "Inter, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
      size: "18px",
      weight: 500,
      lineHeight: 1.3,
      letterSpacing: "-0.012em",
    },
    bodyMd: {
      family:
        "Inter, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
      size: "14px",
      weight: 400,
      lineHeight: 1.5,
      letterSpacing: "-0.003em",
    },
    bodyMdStrong: {
      family:
        "Inter, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
      size: "14px",
      weight: 500,
      lineHeight: 1.5,
      letterSpacing: "-0.003em",
    },
    amount: {
      family:
        "Inter, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
      size: "14px",
      weight: 400,
      lineHeight: 1.5,
      letterSpacing: "0",
    },
    amountStrong: {
      family:
        "Inter, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
      size: "14px",
      weight: 500,
      lineHeight: 1.5,
      letterSpacing: "0",
    },
    amountXl: {
      family:
        "Inter, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
      size: "18px",
      weight: 500,
      lineHeight: 1.3,
      letterSpacing: "-0.012em",
    },
    monoCaps: {
      family: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
      size: "11px",
      weight: 500,
      lineHeight: 1.2,
      letterSpacing: "0.055em",
      textTransform: "uppercase" as const,
    },
  },

  rounded: {
    none: "0px",
    sm: "4px",
    full: "9999px",
  },

  spacing: {
    xxs: "2px",
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "20px",
    "2xl": "24px",
    "3xl": "32px",
    "4xl": "44px",
    "5xl": "48px",
    section: "80px",
  },
} as const;

export type Theme = typeof theme;
