import Link from "next/link";
import styled, { css } from "styled-components";

// A two-tier masthead on desktop: the serif wordmark and account actions on top,
// the section links on a row beneath, closed by a full-strength ink rule that
// the active link's claret underline sits on. The bar and its rule run full
// width; what sits on it keeps to the page's own column, so the wordmark lines
// up with the headline below and the account actions with the content's right
// edge, at every width.
export const Bar = styled.nav`
  ${({ theme }) => css`
    border-bottom: 1px solid ${theme.colors.ink};
    background: ${theme.colors.canvas};
    position: sticky;
    top: 0;
    z-index: 10;
  `}
`;

export const Inner = styled.div`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "brand right"
      "links links";
    align-items: center;
    max-width: 1240px;
    margin: 0 auto;
    padding: ${theme.spacing.lg} ${theme.spacing["2xl"]} 0;
    column-gap: ${theme.spacing["2xl"]};

    /* Brand left, hamburger right — the link row and action cluster move into
       the drawer. Hidden children leave the grid, so two columns suffice. */
    @media (max-width: 767px) {
      height: 56px;
      grid-template-areas: "brand right";
      padding: 0 ${theme.spacing.lg};
    }
  `}
`;

export const Brand = styled(Link)`
  ${({ theme }) => css`
    grid-area: brand;
    font-family: ${theme.typography.displayLg.family};
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: 1.1;

    @media (max-width: 767px) {
      font-size: 21px;
    }
    color: ${theme.colors.ink};
    text-decoration: none;
  `}
`;

export const Links = styled.div`
  grid-area: links;
  display: flex;
  gap: ${({ theme }) => theme.spacing["2xl"]};
  padding-top: ${({ theme }) => theme.spacing.md};

  @media (max-width: 767px) {
    display: none;
  }
`;

export const NavLink = styled(Link)<{ $active: boolean }>`
  ${({ theme, $active }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: 15px;
    font-weight: 600;
    color: ${$active ? theme.colors.accent : theme.colors.ink};
    text-decoration: none;
    padding-bottom: ${theme.spacing.md};
    border-bottom: 4px solid ${$active ? theme.colors.accent : "transparent"};
    margin-bottom: -1px;

    &:hover {
      border-bottom-color: ${$active ? theme.colors.accent : theme.colors.hairlineStrong};
    }
  `}
`;

export const RightZone = styled.div`
  grid-area: right;
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

  /* Sign in shares NavLink's look but not its underline slot: it sits on the
     wordmark's row, away from the rule. */
  ${NavLink} {
    padding-bottom: 0;
    margin-bottom: 0;
    border-bottom: 0;
  }
`;

export const PillLink = styled(Link)`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMdStrong.family};
    font-size: 14px;
    font-weight: 600;
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
    grid-area: right;
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
    font-family: ${theme.typography.bodyMd.family};
    font-size: 17px;
    font-weight: 600;
    color: ${$active ? theme.colors.accent : theme.colors.ink};
    box-shadow: ${$active ? `inset 4px 0 0 ${theme.colors.accent}` : "none"};
    padding-left: ${$active ? theme.spacing.md : "0"};
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
