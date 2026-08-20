"use client";

import { Copy, FooterBar, FooterLink } from "./Footer.styled";

// Rendered by the (app) layout only. It used to check usePathname and return
// null on "/" to avoid doubling up with the landing page's own MarketingFooter
// — the route groups now say that structurally, so it no longer needs to know
// where it is.
//
// It does still need "use client": every element here is a styled component,
// and those read the theme from context, which does not exist in a server
// component. Dropping the directive along with usePathname turned the whole
// footer into a 500 on every page that renders it — and not on "/", because
// the marketing layout is the one place that doesn't.
export function Footer() {
  return (
    <FooterBar>
      <Copy>Balanced Money</Copy>
      {/* Present on every app page: the guide is reference material, and the
          moment someone needs it is the moment something confused them. */}
      <FooterLink href="/guide">Guide</FooterLink>
      {/* Public, like the guide — no session needed to read it. */}
      <FooterLink href="/how-its-built">Engineering</FooterLink>
      <FooterLink href="/privacy">Privacy</FooterLink>
      <FooterLink href="/cookies">Cookies</FooterLink>
      <FooterLink href="/terms">Terms</FooterLink>
    </FooterBar>
  );
}
