import { IdleTimeout } from "@/components/auth/IdleTimeout";
import { Footer } from "@/components/ui/Footer";
import { NavBar } from "@/components/ui/NavBar";
import { getNavFlags, getThemePreference } from "@/lib/settings/server";
import { StyledComponentsRegistry } from "@/lib/styled";
import { getCurrentUser } from "@/lib/supabase/user";
import { themeAttribute, themeCss } from "@/lib/themeCss";
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
  // Resolved on the server so the correct scheme is in the very first paint.
  // Deciding this on the client would mean rendering light, hydrating, then
  // repainting dark — the flash every dark-mode implementation is judged by.
  const theme = themeAttribute(await getThemePreference(user?.id));

  return (
    <html lang="en" data-theme={theme}>
      <head>
        {/* Generated from the palettes rather than a static stylesheet, so the
            two never drift. Inline in <head> so the variables exist before the
            first paint. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: generated from a typed palette in this repo, never from user input. */}
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      </head>
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
