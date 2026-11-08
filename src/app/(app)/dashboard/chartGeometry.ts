// Geometry every dashboard chart shares, so the charts stacked down the page
// read as one column: their plots start and end on the same lines, and their
// month axes space alike.

// The amount axis's gutter. One width for every chart, wide enough for the
// widest label ("-£200k", "£157.2k"); charts that each sized their own put the
// plots' left edges at different points down a phone's single column.
export const AMOUNT_AXIS_WIDTH = 56;

// The cash-flow chart's savings-rate axis on the right ("-25%").
export const RATE_AXIS_WIDTH = 40;

export const CHART_MARGIN = { top: 8, right: 12, bottom: 0, left: 4 };

// Room above the plot for the chips some charts pin over a point.
export const LABELLED_CHART_MARGIN = { ...CHART_MARGIN, top: 28 };

// Month ticks evenly spaced, and always keeping the latest month: Recharts'
// default dropped whichever labels collided, leaving Feb, May, Jul, Oct.
export const MONTH_INTERVAL = "equidistantPreserveEnd" as const;

// Keeps the first and last points off the axis ends, so the first month's
// label clears the lowest amount label in the corner.
export const LINE_X_PADDING = { left: 8, right: 8 };

// Recharts sorts tooltip rows by name, which put "6-month avg" above "Actual"
// and Expense above Income. Ranking every row equal keeps the series order.
export const KEEP_SERIES_ORDER = () => 0;
