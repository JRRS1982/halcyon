"use client";

import { Copy, FooterBar, FooterLink } from "./Footer.styled";

export function Footer() {
  return (
    <FooterBar>
      <Copy>Halcyon</Copy>
      <FooterLink href="/privacy">Privacy</FooterLink>
      <FooterLink href="/terms">Terms</FooterLink>
    </FooterBar>
  );
}
