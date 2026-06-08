import styled, { css } from "styled-components";

export const Section = styled.section`
  ${({ theme }) => css`
    background: ${theme.colors.canvasSoft};
    border-top: 1px solid ${theme.colors.hairline};
    border-bottom: 1px solid ${theme.colors.hairline};
    padding: ${theme.spacing.section} 0;
  `}
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: ${({ theme }) => theme.colors.hairline};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  overflow: hidden;
  margin-top: ${({ theme }) => theme.spacing["4xl"]};

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

export const Cell = styled.div`
  background: ${({ theme }) => theme.colors.canvas};
  padding: ${({ theme }) => `${theme.spacing.xl} ${theme.spacing.lg}`};
`;

export const Key = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.ink};
    margin: 0;
  `}
`;

export const Text = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
    margin: ${theme.spacing.sm} 0 0;
  `}
`;
