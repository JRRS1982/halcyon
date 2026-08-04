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

    /* Brand left, hamburger right — the link row and action cluster move into
       the drawer. Hidden children leave the grid, so two columns suffice. */
    @media (max-width: 767px) {
      grid-template-columns: 1fr auto;
      padding: 0 ${theme.spacing.lg};
    }
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

  @media (max-width: 767px) {
    display: none;
  }
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

  @media (max-width: 767px) {
    display: none;
  }
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

/* ─── Mobile drawer (< 768px) ────────────────────────────────────────────── */

// Hamburger / close toggle. 44px square so it clears the touch-target floor
// (DESIGN.md → Responsive Strategy → Touch Targets).
export const MenuButton = styled.button`
  ${({ theme }) => css`
    display: none;
    width: 44px;
    height: 44px;
    align-items: center;
    justify-content: center;
    justify-self: end;
    margin-right: -${theme.spacing.md};
    background: none;
    border: none;
    padding: 0;
    color: ${theme.colors.ink};
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid ${theme.colors.accent};
      outline-offset: -2px;
    }

    @media (max-width: 767px) {
      display: flex;
    }
  `}
`;

// Full-overlay drawer sitting directly under the 56px bar.
export const Drawer = styled.div`
  ${({ theme }) => css`
    display: none;

    @media (max-width: 767px) {
      display: flex;
      flex-direction: column;
      position: fixed;
      inset: 56px 0 0 0;
      z-index: 9;
      background: ${theme.colors.canvas};
      padding: ${theme.spacing.sm} ${theme.spacing.lg} ${theme.spacing["3xl"]};
      overflow-y: auto;
      overscroll-behavior: contain;
    }
  `}
`;

// Stacked drawer link. Full-width hairline-separated rows at >= 44px.
export const DrawerLink = styled(Link)<{ $active: boolean }>`
  ${({ theme, $active }) => css`
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: ${theme.spacing.md} 0;
    border-bottom: 1px solid ${theme.colors.hairline};
    font-family: ${theme.typography.monoCaps.family};
    font-size: 13px;
    font-weight: ${$active ? 700 : theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${$active ? theme.colors.ink : theme.colors.body};
    text-decoration: none;

    &:focus-visible {
      outline: 2px solid ${theme.colors.accent};
      outline-offset: -2px;
    }
  `}
`;

// Action cluster pinned below the link list (Sign out, or Sign in + Get started).
export const DrawerActions = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.md};
    margin-top: ${theme.spacing.xl};

    /* The shared Button and PillLink render ~30px tall; inflate both to the
       44px touch floor inside the drawer. */
    button,
    a {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
    }
  `}
`;
