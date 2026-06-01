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
