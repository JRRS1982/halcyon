"use client";

import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  planVisible: boolean;
};

type NavItem = { href: string; label: string };

// Signed-in app links. "Home" is intentionally absent: signed-in users are
// redirected away from "/" to "/dashboard", so a Home tab would only point at
// a redirect. Plan and Transactions are opt-in and slot in before Settings.
const SIGNED_IN_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/budget", label: "Budget" },
  { href: "/balance", label: "Balance" },
  { href: "/settings", label: "Settings" },
];

const PLAN_ITEM: NavItem = { href: "/plan", label: "Plan" };

const TRANSACTIONS_ITEM: NavItem = {
  href: "/transactions",
  label: "Transactions",
};

// Homepage-only in-page anchors (the sections only exist on "/").
const MARKETING_ITEMS: NavItem[] = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#details", label: "Details" },
];

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

export function NavBar({
  signedIn,
  transactionsEnabled,
  planVisible,
}: NavBarProps) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const middle: NavItem[] = [...SIGNED_IN_ITEMS.slice(0, -1)]; // Dashboard, Budget, Balance
  if (planVisible) middle.push(PLAN_ITEM);
  if (transactionsEnabled) middle.push(TRANSACTIONS_ITEM);
  const items: NavItem[] = [...middle, ...SIGNED_IN_ITEMS.slice(-1)]; // + Settings

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

  const drawerItems = signedIn ? items : isHome ? MARKETING_ITEMS : [];

  return (
    <Bar>
      <Brand href="/">Balanced Money</Brand>

      <Links>
        {signedIn
          ? items.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                $active={pathname === item.href}
              >
                {item.label}
              </NavLink>
            ))
          : isHome
            ? MARKETING_ITEMS.map((item) => (
                <NavLink key={item.href} href={item.href} $active={false}>
                  {item.label}
                </NavLink>
              ))
            : null}
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
          {drawerItems.map((item) => (
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
                <NavLink
                  href="/sign-in"
                  $active={pathname === "/sign-in"}
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
