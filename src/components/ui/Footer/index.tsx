"use client";

import { usePathname } from "next/navigation";
import { Copy, FooterBar, FooterLink } from "./Footer.styled";

export function Footer() {
  const pathname = usePathname();
  // The landing page ("/") supplies its own MarketingFooter, so the global
  // footer steps aside there to avoid a double footer.
  if (pathname === "/") return null;

  return (
    <FooterBar>
      <Copy>Balanced Money</Copy>
      {/* Present on every app page: the guide is reference material, and the
          moment someone needs it is the moment something confused them. */}
      <FooterLink href="/about">How it works</FooterLink>
      <FooterLink href="/privacy">Privacy</FooterLink>
      <FooterLink href="/terms">Terms</FooterLink>
    </FooterBar>
  );
}
