import Link from "next/link";
import styled from "styled-components";

// The rule runs full width; the links sit centred in the page's column. Left
// aligned under the wordmark, they read as off centre on every page whose
// content is a narrower centred column (Settings, Plan's first run).
export const FooterBar = styled.footer`
  border-top: 1px solid ${({ theme }) => theme.colors.ink};
`;

export const FooterRow = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["2xl"]};
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  /* Baseline, not centre: the 13px name and the 14px links share one line of
     type, and centring their boxes set the name half a pixel off it. */
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing["2xl"]};

  /* Links become 44px targets on a phone; the row gap closes up so the
     wrapped rows do not double the footer's height. */
  @media (max-width: 767px) {
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
    gap: 0 ${({ theme }) => theme.spacing.xl};
  }
`;

export const FooterLink = styled(Link)`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.ink};
  text-decoration: none;

  @media (max-width: 767px) {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
    text-decoration: underline;
  }
`;

export const Copy = styled.span`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.dim};
`;
