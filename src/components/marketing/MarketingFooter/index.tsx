import {
  Blurb,
  Brand,
  ColTitle,
  Foot,
  FootLink,
  Grid,
  Inner,
} from "./MarketingFooter.styled";

export function MarketingFooter() {
  return (
    <Foot>
      <Inner>
        <Grid>
          <div>
            <Brand>Balanced Money</Brand>
            <Blurb>
              See where your money went, then plan where it goes next.
            </Blurb>
          </div>
          <div>
            <ColTitle>Product</ColTitle>
            <FootLink href="/features">Features</FootLink>
            <FootLink href="/guide">Guide</FootLink>
            <FootLink href="/how-its-built">Engineering</FootLink>
            {/* The design system, rendered from DESIGN.md. Sits under Product
                rather than Legal: it is the thing itself, not a policy. */}
            <FootLink href="/design">Design</FootLink>
          </div>
          <div>
            <ColTitle>Legal</ColTitle>
            <FootLink href="/terms">Terms</FootLink>
            <FootLink href="/privacy">Privacy</FootLink>
            <FootLink href="/cookies">Cookies</FootLink>
          </div>
        </Grid>
      </Inner>
    </Foot>
  );
}
