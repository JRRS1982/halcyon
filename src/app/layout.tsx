import { IdleTimeout } from "@/components/auth/IdleTimeout";
import { Footer } from "@/components/ui/Footer";
import { NavBar } from "@/components/ui/NavBar";
import { getNavFlags } from "@/lib/settings/server";
import { StyledComponentsRegistry } from "@/lib/styled";
import { getCurrentUser } from "@/lib/supabase/user";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Balanced Money",
  description:
    "Personal finance, made clear. Track what you have, understand where it goes.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  // One settings read for both nav flags rather than two round-trips.
  const { transactionsEnabled, planVisible } = await getNavFlags(user?.id);

  return (
    <html lang="en">
      <body className={inter.className}>
        {/* First focusable thing on the page, so a keyboard or screen-reader
            user can jump the nav instead of tabbing through it on every route.
            Plain CSS and a plain anchor rather than a styled component: it has
            to work before hydration, which is when someone tabbing at speed
            will reach it. */}
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <StyledComponentsRegistry>
          <NavBar
            signedIn={!!user}
            transactionsEnabled={transactionsEnabled}
            planVisible={planVisible}
          />
          {/* tabIndex -1 makes the target programmatically focusable, so the
              jump actually moves focus rather than only scrolling. */}
          <div className="app-content" id="main-content" tabIndex={-1}>
            {children}
          </div>
          <Footer />
          {user && <IdleTimeout />}
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
