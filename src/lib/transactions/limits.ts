// Import size limits, shared by the client picker and the server action so the
// two can't drift. Rows travel to the server action as JSON `string[][]`, which
// is bulkier than the source CSV, so the byte cap is the one that actually
// binds — `experimental.serverActions.bodySizeLimit` in next.config.mjs is set
// to match MAX_IMPORT_FILE_BYTES.
//
// Sizing: one account-year of statements is typically 500–2,000 rows, so 5,000
// covers a multi-year export while keeping a single import bounded.

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;

// Per-user ceiling on stored (live) transactions. Per-import size is already
// bounded by MAX_IMPORT_ROWS, but the number of imports was not — a signed-in
// account could loop the commit action and grow the shared Transaction table
// without limit, inflating storage/backup cost and degrading every query that
// scans it (dashboard, budget actuals, export). Sizing: decades of multi-account
// history sit far below this, so it only ever bites automated abuse.
export const MAX_TRANSACTIONS_PER_USER = 250_000;

export const MAX_IMPORT_FILE_MB = MAX_IMPORT_FILE_BYTES / (1024 * 1024);

// Shown next to the file picker and reused in the rejection messages so the
// limit reads identically wherever the user meets it.
export const importLimitHint = `CSV · up to ${MAX_IMPORT_ROWS.toLocaleString()} rows · max ${MAX_IMPORT_FILE_MB}MB`;
