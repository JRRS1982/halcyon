import { IdleTimeout } from "@/components/auth/IdleTimeout";
import { Footer } from "@/components/ui/Footer";
import { NavBar } from "@/components/ui/NavBar";
import { getLayoutSettings } from "@/lib/settings/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { themeAttribute } from "@/lib/themeCss";

/**
 * Everything that needs to know who is looking: the app pages, the auth pages,
 * and the public content pages a signed-in user can reach from the nav.
 *
 * Reading the session here rather than in the root layout is what lets the
 * marketing page prerender — see the note there.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  // One settings read for the nav flag and the colour scheme alike — they are
  // two columns of the same row, so asking separately was two round-trips
  // for one row. The scheme is resolved on the server so the correct one is in
  // the very first paint: deciding it on the client would mean rendering light,
  // hydrating, then repainting dark — the flash every dark-mode implementation
  // is judged by.
  const { transactionsEnabled, themePreference } = await getLayoutSettings(
    user?.id,
  );
  const theme = themeAttribute(themePreference);

  // The scheme sits on a wrapper rather than on <html>, because <html> belongs
  // to the root layout and moving the session up there is exactly what this
  // split undoes. Custom properties and `color-scheme` both inherit, so a
  // wrapper covers everything inside it. Visitors without a stored preference
  // — including everyone on the marketing page — fall through to the media
  // query in themeCss.
  return (
    // app-shell keeps body's sticky-footer flex running through this wrapper —
    // see globals.css. Without it the footer rides up on short pages.
    <div
      className="app-shell"
      data-theme={theme}
      style={theme ? { colorScheme: theme } : undefined}
    >
      <NavBar signedIn={!!user} transactionsEnabled={transactionsEnabled} />
      {/* tabIndex -1 makes the skip link's target programmatically focusable,
          so the jump moves focus rather than only scrolling. */}
      <div className="app-content" id="main-content" tabIndex={-1}>
        {children}
      </div>
      <Footer />
      {user && <IdleTimeout />}
    </div>
  );
}
