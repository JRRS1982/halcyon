import styled from "styled-components";

// Shared section heading for the Settings page (Format, Transactions,
// Categories). Larger + inked with a hairline rule, so sections read clearly —
// distinct from the small dim field labels.
export const SectionHeading = styled.h2`
  margin: ${({ theme }) => theme.spacing["3xl"]} 0
    ${({ theme }) => theme.spacing.lg};
  padding-bottom: ${({ theme }) => theme.spacing.xs};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  color: ${({ theme }) => theme.colors.ink};
`;

// Card around one settings section (heading + its fields), so the page's
// nine sections read as distinct blocks rather than one continuous scroll —
// the same hairline-card treatment the plan and dashboard panels use.
export const SettingsCard = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  padding: ${({ theme }) => theme.spacing.xl};
  margin-top: ${({ theme }) => theme.spacing.xl};

  /* The heading opens the card, so the flow margin that separates it from a
     previous sibling has no work to do here. */
  & > ${SectionHeading}:first-child {
    margin-top: 0;
  }
`;
