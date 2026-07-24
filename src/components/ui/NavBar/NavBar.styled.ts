import Link from "next/link";
import styled, { css } from "styled-components";

export const Bar = styled.nav`
  ${({ theme }) => css`
    height: 56px;
    border-bottom: 1px solid ${theme.colors.hairline};
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 0 ${theme.spacing["2xl"]};
    column-gap: ${theme.spacing["2xl"]};
    background: ${theme.colors.canvas};
    position: sticky;
    top: 0;
    z-index: 10;
  `}
`;

export const Brand = styled(Link)`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.005em;
    color: ${theme.colors.ink};
    text-decoration: none;
  `}
`;

export const Links = styled.div`
  display: flex;
  justify-self: center;
  gap: ${({ theme }) => theme.spacing["2xl"]};
`;

export const NavLink = styled(Link)<{ $active: boolean }>`
  ${({ theme, $active }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: 12px;
    font-weight: ${$active ? 700 : theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${$active ? theme.colors.ink : theme.colors.body};
    text-decoration: none;
    padding-bottom: 2px;
    border-bottom: 2px solid ${$active ? theme.colors.ink : "transparent"};

    &:hover {
      color: ${theme.colors.ink};
    }
  `}
`;

export const RightZone = styled.div`
  display: flex;
  align-items: center;
  justify-self: end;
`;

export const RightGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
`;

export const PillLink = styled(Link)`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    background: ${theme.colors.primary};
    color: ${theme.colors.onPrimary};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.sm} ${theme.spacing.lg};
    white-space: nowrap;
    text-decoration: none;
    transition: opacity 100ms;

    &:hover {
      opacity: 0.85;
    }
  `}
`;
