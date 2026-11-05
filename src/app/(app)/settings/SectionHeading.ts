import styled from "styled-components";

// Shared section heading for the Settings page (Format, Transactions,
// Categories): the serif section head, distinct from the small field labels.
export const SectionHeading = styled.h2`
  margin: ${({ theme }) => theme.spacing["3xl"]} 0
    ${({ theme }) => theme.spacing.lg};
  font-family: ${({ theme }) => theme.typography.displayLg.family};
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  line-height: ${({ theme }) => theme.typography.displayLg.lineHeight};
  color: ${({ theme }) => theme.colors.ink};
`;

// One settings section (heading + its fields), ruled off from the one above
// so the page's sections read as distinct blocks rather than one continuous
// scroll, the same ruled-section treatment the plan and dashboard panels use.
export const SettingsCard = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.ink};
  padding: ${({ theme }) => theme.spacing.lg} 0 ${({ theme }) => theme.spacing.xl};
  margin-top: ${({ theme }) => theme.spacing.xl};

  /* The heading opens the section, so the flow margin that separates it from a
     previous sibling has no work to do here. */
  & > ${SectionHeading}:first-child {
    margin-top: 0;
  }
`;
