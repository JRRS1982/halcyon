import styled from "styled-components";

// The page's two parts — adding transactions, then reviewing them — each open
// as DESIGN.md → Ruled Sections sets a section: a 1px ink rule, then the 20px
// serif head. Before, the add controls and the ledger's filters ran on one
// after the other, and nothing said where one job ended and the next began.
export const SectionHead = styled.h2`
  margin: 0;
  padding-top: ${({ theme }) => theme.spacing.lg};
  border-top: 1px solid ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.displayLg.family};
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  line-height: ${({ theme }) => theme.typography.displayLg.lineHeight};
  color: ${({ theme }) => theme.colors.ink};
`;
