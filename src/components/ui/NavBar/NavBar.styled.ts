import Link from "next/link";
import styled, { css } from "styled-components";

export const Bar = styled.nav`
  ${({ theme }) => css`
    height: 56px;
    border-bottom: 1px solid ${theme.colors.hairline};
    display: flex;
    align-items: center;
    padding: 0 ${theme.spacing["2xl"]};
    gap: ${theme.spacing["2xl"]};
    background: ${theme.colors.canvas};
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
  gap: ${({ theme }) => theme.spacing["2xl"]};
`;

export const NavLink = styled(Link)<{ $active: boolean }>`
  ${({ theme, $active }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${$active ? theme.colors.ink : theme.colors.body};
    text-decoration: none;

    &:hover {
      color: ${theme.colors.ink};
    }
  `}
`;

export const Spacer = styled.div`
  flex: 1;
`;
