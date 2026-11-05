import styled, { css } from "styled-components";

export const HeaderRow = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing["2xl"]};
  margin-bottom: ${({ theme }) => theme.spacing.xl};

  @media (max-width: 767px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

export const HeaderLeft = styled.div`
  flex: 1;
  min-width: 0;
`;

export const Eyebrow = styled.div`
  ${({ theme }) => css`
    font-family: ${theme.typography.kicker.family};
    font-size: ${theme.typography.kicker.size};
    font-weight: ${theme.typography.kicker.weight};
    line-height: ${theme.typography.kicker.lineHeight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.kicker.letterSpacing};
    color: ${theme.colors.accent};
  `}
`;

export const Title = styled.h1`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayXl.family};
    font-size: ${theme.typography.displayXl.size};
    font-weight: ${theme.typography.displayXl.weight};
    line-height: ${theme.typography.displayXl.lineHeight};
    letter-spacing: ${theme.typography.displayXl.letterSpacing};
    color: ${theme.colors.ink};
    margin: ${theme.spacing.xs} 0 0 0;
  `}
`;

export const Lead = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: 17px;
    font-weight: ${theme.typography.bodyMd.weight};
    line-height: 1.45;
    color: ${theme.colors.body};
    margin: ${theme.spacing.sm} 0 0 0;
    max-width: 720px;
  `}
`;

export const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;
