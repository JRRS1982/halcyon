import { StyledComponentsRegistry } from "@/lib/styled";
import { themeCss } from "@/lib/themeCss";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Balanced Money",
  description:
    "Personal finance, made clear. Track what you have, understand where it goes.",
};

/**
 * Deliberately knows nothing about the signed-in user.
 *
 * A layout that reads the session makes every route beneath it dynamic, and
 * this one sits above all of them — so asking "who is this?" here meant the
 * marketing page was rendered per request, behind an auth round-trip, on the
 * one page whose load time decides whether a stranger stays. The session moved
 * down into (app), which needs it anyway; (marketing) does without and
 * prerenders.
 *
 * What stays here is what every page shares regardless of who is looking: the
 * document, the font, the colour-scheme variables, and the skip link.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
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
        <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
      </body>
    </html>
  );
}
