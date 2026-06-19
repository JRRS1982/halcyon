"use client";

import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { usePathname } from "next/navigation";
import {
  Bar,
  Brand,
  Links,
  NavLink,
  PillLink,
  RightGroup,
  Spacer,
} from "./NavBar.styled";

type NavBarProps = {
  signedIn: boolean;
  transactionsEnabled: boolean;
};

type NavItem = { href: string; label: string };

// Signed-in app links. "Home" is intentionally absent: signed-in users are
// redirected away from "/" to "/dashboard", so a Home tab would only point at
// a redirect. Transactions is opt-in and slots in before Settings.
const SIGNED_IN_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/budget", label: "Budget" },
  { href: "/balance", label: "Balance" },
  { href: "/plan", label: "Plan" },
  { href: "/settings", label: "Settings" },
];

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

export function NavBar({ signedIn, transactionsEnabled }: NavBarProps) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  const items = transactionsEnabled
    ? [
        ...SIGNED_IN_ITEMS.slice(0, -1),
        TRANSACTIONS_ITEM,
        ...SIGNED_IN_ITEMS.slice(-1),
      ]
    : SIGNED_IN_ITEMS;

  return (
    <Bar>
      <Brand href="/">Balanced Money</Brand>

      {signedIn ? (
        <Links>
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
      ) : isHome ? (
        <Links>
          {MARKETING_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} $active={false}>
              {item.label}
            </NavLink>
          ))}
        </Links>
      ) : null}

      <Spacer />

      {signedIn ? (
        <form action={signOut}>
          <Button type="submit">Sign out</Button>
        </form>
      ) : (
        <RightGroup>
          <NavLink href="/sign-in" $active={pathname === "/sign-in"}>
            Sign in
          </NavLink>
          <PillLink href="/sign-up">Get started</PillLink>
        </RightGroup>
      )}
    </Bar>
  );
}
