import { NavBar } from "@/components/ui/NavBar";

/**
 * The marketing page, and nothing that needs a session.
 *
 * `signedIn={false}` is a statement of fact rather than an assumption: the
 * proxy redirects anyone with a session away from "/" before the request gets
 * here, so a signed-in visitor never renders this tree. That is what lets the
 * whole group prerender — no session lookup, no per-request work, no auth
 * round-trip in front of the page a stranger judges the product by.
 *
 * No <Footer /> here: the landing page supplies its own MarketingFooter, which
 * is why the global one used to check the pathname and render nothing on "/".
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <NavBar signedIn={false} transactionsEnabled={false} />
      <div className="app-content" id="main-content" tabIndex={-1}>
        {children}
      </div>
    </>
  );
}
