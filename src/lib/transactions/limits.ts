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

// Counts every row the user has, including soft-deleted ones.
//
// Both delete paths are soft — reverseImport stamps a whole batch,
// bulkDeleteTransactions stamps a selection — and neither row ever comes back:
// nothing restores a transaction and dedupe already ignores the tombstones. So
// a cap that counted live rows let commit → reverse → repeat write permanently
// while reporting no change, which is precisely the loop the comment above says
// this constant exists to stop.
//
// Not hard deleted, unlike the budget and balance rows that copy-forward
// replaces: the data export reads transactions with no deletedAt filter, so
// these are still the user's data and removing them would change what an export
// contains. That is a decision about retention, not a bug to fix behind it.
export type TransactionCountDelegate = {
  count(args: { where: { userId: string } }): Promise<number>;
};

export const countedByCap = (
  db: TransactionCountDelegate,
  userId: string,
): Promise<number> => db.count({ where: { userId } });

// Per-user ceiling on dismissed possible-transfer pairs ("Not a transfer").
// One record per pair of rows, but a row whose pair is dismissed can pair
// again with another row, so the count is bounded by rows only loosely.
// Counted over every record (none are soft deleted). Records that stopped
// applying (a row deleted, edited or moved) are removed before each count —
// see dismissWithinCap — so the cap is spent only on pairs the user can see
// under Show hidden pairs. A person dismisses a handful a month; only a script
// gets near it.
export const MAX_DISMISSED_PAIRS_PER_USER = 10_000;

// Pairs one possible-transfers action accepts: each is two updates in one
// database transaction. The ledger sends at most this many per click.
export const MAX_PAIRS_PER_ACTION = 250;

export const MAX_IMPORT_FILE_MB = MAX_IMPORT_FILE_BYTES / (1024 * 1024);

// Shown next to the file picker and reused in the rejection messages so the
// limit reads identically wherever the user meets it.
export const importLimitHint = `CSV · up to ${MAX_IMPORT_ROWS.toLocaleString()} rows · max ${MAX_IMPORT_FILE_MB}MB`;
