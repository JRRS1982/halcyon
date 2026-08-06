// Where a user ends up after authenticating when nothing else asked for a
// specific destination.
//
// This used to be "/", relying on the marketing page to bounce them onward.
// That bounce now lives in the proxy, which sees hard navigations (the OAuth
// callback) but not the RSC navigation a server-action `redirect()` produces —
// so sign-in would have parked the user on the marketing page. Naming the real
// destination up front fixes that and removes a redirect hop from every login.
export const POST_AUTH_LANDING = "/dashboard";
