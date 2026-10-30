"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import {
  Bar,
  Brand,
  Drawer,
  DrawerActions,
  DrawerLink,
  Links,
  MenuButton,
  NavLink,
  PillLink,
  RightGroup,
  RightZone,
} from "./NavBar.styled";

type NavBarProps = {
  signedIn: boolean;
  transactionsEnabled: boolean;
};

type NavItem = { href: string; label: string };

// Guide leads: it is the page that explains the order of everything after it,
// so it should be the first thing read rather than something found at the end
// of the row once you are already lost. The rest are ordered by the way the app
// is actually used, not by importance: import a statement, categorise it, check
// the budget, update balances, then read the dashboard — the rhythm /guide
// describes. Dashboard sits late because it is the read-only result of the four
// steps before it, Plan after it because it is the long view rather than part
// of the month, and Settings last as configuration rather than part of the loop.
//
// "Home" is intentionally absent: signed-in users are redirected away from "/",
// so a Home tab would only ever point at a redirect.
type NavEntry = NavItem & {
  /** Optional entries appear only when their feature is switched on. */
  requires?: "transactions";
};

const SIGNED_IN_ITEMS: NavEntry[] = [
  { href: "/guide", label: "Guide" },
  { href: "/transactions", label: "Transactions", requires: "transactions" },
  { href: "/budget", label: "Budget" },
  { href: "/balance", label: "Balance" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/plan", label: "Plan" },
  { href: "/settings", label: "Settings" },
];

// Homepage-only in-page anchors (the sections only exist on "/").
const MARKETING_ITEMS: NavItem[] = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#details", label: "Details" },
];

// /guide is not behind the auth guard, and it is the best answer to "what is
// this and how would I use it?" — so it stays in the bar signed out too,
// including on the pages where the homepage anchors above mean nothing.
const GUIDE_ITEM: NavItem = { href: "/guide", label: "Guide" };

// The exceptions: the auth pages carry one job each, and a link out of the form
// is a way to abandon it. /guide is one route away via the homepage brand.
const BARE_NAV_PATHS = new Set(["/guide", "/sign-in", "/sign-up"]);

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {open ? (
        <>
          <line x1="3.5" y1="3.5" x2="14.5" y2="14.5" />
          <line x1="14.5" y1="3.5" x2="3.5" y2="14.5" />
        </>
      ) : (
        <>
          <line x1="2" y1="4.5" x2="16" y2="4.5" />
          <line x1="2" y1="9" x2="16" y2="9" />
          <line x1="2" y1="13.5" x2="16" y2="13.5" />
        </>
      )}
    </svg>
  );
}

export function NavBar({ signedIn, transactionsEnabled }: NavBarProps) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  // Signed out, GUIDE_ITEM is the whole bar off the homepage — and on the guide
  // that makes it a link to the page being read. Dropped there and on the auth
  // pages, leaving the brand. The signed-in bar keeps its Guide entry: it is
  // primary navigation, and removing one item on one route would shift every
  // other link sideways.
  const isBareNav = BARE_NAV_PATHS.has(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Filtered rather than spliced, so the declared order above is the order
  // rendered and switching a feature on drops it into place.
  const enabled = { transactions: transactionsEnabled };
  const items: NavItem[] = signedIn
    ? SIGNED_IN_ITEMS.filter((item) => !item.requires || enabled[item.requires])
    : isHome
      ? [GUIDE_ITEM, ...MARKETING_ITEMS]
      : isBareNav
        ? []
        : [GUIDE_ITEM];

  // Navigating away closes the drawer — Next keeps the layout mounted across
  // route changes, so it would otherwise stay open over the new page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, not a value read here.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // The drawer covers the viewport, so the page behind it must not scroll.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  // Escape closes and returns focus to the toggle that opened it.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <Bar>
      <Brand href="/">Balanced Money</Brand>

      <Links>
        {/* The in-page anchors never match a pathname, so they are never marked
            active without needing to say so. */}
        {items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            $active={pathname === item.href}
          >
            {item.label}
          </NavLink>
        ))}
      </Links>

      <RightZone>
        {signedIn ? (
          <form action={signOut}>
            <Button type="submit">Sign out</Button>
          </form>
        ) : (
          <RightGroup>
            {/* Never marked active: signed out, "Sign in" is the only
                destination, so highlighting it carries no information. */}
            <NavLink href="/sign-in" $active={false}>
              Sign in
            </NavLink>
            <PillLink href="/sign-up">Get started</PillLink>
          </RightGroup>
        )}
      </RightZone>

      <MenuButton
        ref={menuButtonRef}
        type="button"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        aria-controls="mobile-nav"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <HamburgerIcon open={menuOpen} />
      </MenuButton>

      {menuOpen && (
        <Drawer id="mobile-nav">
          {items.map((item) => (
            <DrawerLink
              key={item.href}
              href={item.href}
              $active={pathname === item.href}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </DrawerLink>
          ))}

          <DrawerActions>
            {signedIn ? (
              <form action={signOut}>
                <Button type="submit">Sign out</Button>
              </form>
            ) : (
              <>
                <PillLink href="/sign-up" onClick={() => setMenuOpen(false)}>
                  Get started
                </PillLink>
                {/* Not marked active, matching the inline nav above. */}
                <NavLink
                  href="/sign-in"
                  $active={false}
                  onClick={() => setMenuOpen(false)}
                >
                  Sign in
                </NavLink>
              </>
            )}
          </DrawerActions>
        </Drawer>
      )}
    </Bar>
  );
}
