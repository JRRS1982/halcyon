// Per-user ceiling on accounts.
//
// createAccount was the last creation path in the app without one — transactions,
// periods, budget rows and plan rows all have theirs. It is also the worst one
// to leave open, because an account is not just a row: each one adds a
// BalanceItem to every month it appears in, and plan Sync fans every live
// account out into a PlanAsset or PlanLiability. So an uncapped account list
// multiplies into the two tables that caps were added to protect.
//
// Sizing: a person tracking every current account, savings pot, ISA, pension
// and mortgage they have is in the tens. 500 is far past that and only ever
// bites automated abuse.
export const MAX_ACCOUNTS_PER_USER = 500;

export const accountLimitError = () =>
  new Error(
    `You have reached the maximum of ${MAX_ACCOUNTS_PER_USER} accounts.`,
  );
