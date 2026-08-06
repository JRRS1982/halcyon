// Where a user ends up after authenticating when nothing else asked for a
// specific destination.
//
// Transactions rather than the dashboard: importing a statement is the single
// action that fills the budget, the charts and the category breakdown at once,
// so it's both the fastest route to a useful app for a new user and the top of
// the monthly routine for an existing one. The dashboard is a read-only view
// of work done elsewhere — landing there first shows a returning user their
// numbers, but shows a new one four empty panels.
//
// It has to be named rather than left as "/": the proxy sees hard navigations
// (the OAuth callback, a typed-in URL) but not the RSC navigation a server
// action's redirect() produces, so relying on the marketing page to bounce
// people onward would park them there after signing in.
//
// A `?next=` on the sign-in URL still wins, so being bounced to sign-in from a
// protected page still returns you to that page.
export const POST_AUTH_LANDING = "/transactions";
