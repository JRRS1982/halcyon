// src/app/plan/axisGeometry.ts
// Single source of the horizontal plot geometry shared by the chart and the
// timeline so a given age lines up vertically between them. Measured in px from
// each panel's content-box (inside border + padding) — both panels use PlanCard,
// so their content-box left edges coincide and these insets map to the same x.

// Plot starts this far from the content-box left. Doubles as the timeline's
// label-gutter width and the chart's (margin.left + YAxis width).
export const PLOT_LEFT_INSET = 140;

// On a phone the 140px gutter is dead space — it exists to give the timeline's
// row labels room and keep the chart's Y axis aligned with them, but at 390px
// it eats a third of the card. This narrower inset still fits the chart's
// widest Y label ("−£500k") and an ellipsized timeline row label; both panels
// swap to it below the same breakpoint so their plots stay aligned.
export const PLOT_LEFT_INSET_PHONE = 64;
export const PHONE_PLOT_QUERY = "(max-width: 767px)";

// Plot ends this far from the content-box right (the chart's margin.right and the
// timeline track's right inset).
export const PLOT_RIGHT_INSET = 16;

// Height (px) of each plan chart's plot area. Taller than a typical chart so the
// fixed-step gridlines get more vertical room and growth over the plan reads
// clearly. Shared so all three charts stay the same height.
export const PLOT_HEIGHT = 480;
