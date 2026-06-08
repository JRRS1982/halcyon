import styled, { css } from "styled-components";

export const Row = styled.section`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.section};
  align-items: center;
  padding: ${({ theme }) => `${theme.spacing["5xl"]} 0`};

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing["3xl"]};
  }
`;

export const Copy = styled.div`
  max-width: 44ch;
`;

export const Eyebrow = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.body};
    margin: 0;
  `}
`;

export const Title = styled.h3`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayLg.family};
    font-size: ${theme.typography.displayLg.size};
    font-weight: ${theme.typography.displayLg.weight};
    line-height: ${theme.typography.displayLg.lineHeight};
    letter-spacing: ${theme.typography.displayLg.letterSpacing};
    color: ${theme.colors.ink};
    margin: ${theme.spacing.sm} 0 0;
  `}
`;

export const Body = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
    margin: ${theme.spacing.md} 0 0;
  `}
`;

export const BulletList = styled.ul`
  list-style: none;
  margin: ${({ theme }) => theme.spacing.lg} 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const Bullet = styled.li`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
  `}
`;

export const BulletKey = styled.span`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.ink};
    margin-right: ${theme.spacing.sm};
  `}
`;
