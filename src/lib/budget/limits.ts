// Per-period ceiling on budget rows.
//
// Rows are added one at a time by createItemForMonth, and copyPeriodFrom
// duplicates a whole period into another month in one transaction. Neither was
// bounded, so a period could hold unlimited rows and the copy then multiplied
// them: one call wrote N rows, making it an N-times amplifier on period
// creation rather than the one-row-per-call the period ceiling assumes.
//
// Sizing: a sheet is a page a person reads. The starter sheet seeds 17 rows and
// a detailed budget runs to a few dozen, so 500 is far past useful and only
// ever bites automated abuse.
export const MAX_ITEMS_PER_PERIOD = 500;

export const periodFullError = () =>
  new Error(
    `This month already has the maximum of ${MAX_ITEMS_PER_PERIOD} rows.`,
  );
