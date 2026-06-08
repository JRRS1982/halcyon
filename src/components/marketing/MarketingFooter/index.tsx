import {
  Blurb,
  Brand,
  ColTitle,
  Foot,
  FootLink,
  Grid,
} from "./MarketingFooter.styled";

export function MarketingFooter() {
  return (
    <Foot>
      <Grid>
        <div>
          <Brand>Balanced Money</Brand>
          <Blurb>
            Personal finance, made clear. Track what you have, understand where
            it goes.
          </Blurb>
        </div>
        <div>
          <ColTitle>Product</ColTitle>
          <FootLink href="#how">How it works</FootLink>
          <FootLink href="#features">Features</FootLink>
          <FootLink href="#details">Details</FootLink>
        </div>
        <div>
          <ColTitle>Legal</ColTitle>
          <FootLink href="/terms">Terms of Service</FootLink>
          <FootLink href="/privacy">Data Privacy</FootLink>
        </div>
      </Grid>
    </Foot>
  );
}
