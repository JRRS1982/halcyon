import Link from "next/link";
import styled, { css } from "styled-components";

// Constrains the page to the 1240px container with page gutters.
export const Container = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing["2xl"]};

  @media (max-width: 760px) {
    padding: 0 ${({ theme }) => theme.spacing.lg};
  }
`;

// A section of stories, opened by a heavy ink rule and a one-word head.
export const Inside = styled.section`
  ${({ theme }) => css`
    padding: ${theme.spacing.lg} 0 ${theme.spacing["3xl"]};
    border-top: 3px solid ${theme.colors.ink};

    > h2 {
      margin-bottom: ${theme.spacing.lg};
    }
  `}
`;

// The lead story across the page: the dashboard's chart beside its text.
export const Lead = styled(Link)`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: minmax(240px, 1fr) minmax(0, 3fr);
    gap: ${theme.spacing["2xl"]};
    align-items: start;
    padding: ${theme.spacing.xl} 0 ${theme.spacing["2xl"]};
    border-top: 1px solid ${theme.colors.ink};
    color: ${theme.colors.ink};
    text-decoration: none;

    h3 {
      margin-top: 0;
    }
    &:hover h3,
    &:focus-visible h3 {
      text-decoration: underline;
      text-decoration-thickness: 2px;
      text-underline-offset: 4px;
    }

    /* Stacked, the picture leads, as it does in every other story. */
    @media (max-width: 860px) {
      grid-template-columns: 1fr;
      gap: ${theme.spacing.lg};

      > :last-child {
        order: -1;
      }
    }
  `}
`;
