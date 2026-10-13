// Per-user ceiling on categories.
//
// A category is not one row either: it is a picker entry on every budget
// sheet, a series in the category-expenditure chart, and a candidate row on
// every plan Sync. The budget sheet it feeds is already capped at
// MAX_ITEMS_PER_PERIOD, so more categories than a single month can hold rows
// for buys the user nothing and only ever came from a loop.
//
// Sizing: the starter set seeds 41 and a person who categorises in detail runs
// to maybe a hundred. 500 matches the per-period row ceiling it feeds.
export const MAX_CATEGORIES_PER_USER = 500;

export const categoryLimitError = () =>
  new Error(
    `You have reached the maximum of ${MAX_CATEGORIES_PER_USER} categories.`,
  );
