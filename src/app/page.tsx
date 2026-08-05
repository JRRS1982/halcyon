import { LandingPage } from "@/components/marketing/LandingPage";

// Signed-in users never reach this: the proxy redirects "/" to POST_AUTH_LANDING
// before the request gets here, using the session check it already performs
// on every request. Doing it there rather than in this component saves a
// second auth round-trip on every visit to the marketing page — the one page
// where first-load speed decides whether a prospect stays.
export default function Home() {
  return <LandingPage />;
}
