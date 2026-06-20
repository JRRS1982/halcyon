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

export function NavBar({
  signedIn,
  transactionsEnabled,
  planVisible,
}: NavBarProps) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  const middle: NavItem[] = [...SIGNED_IN_ITEMS.slice(0, -1)]; // Dashboard, Budget, Balance
  if (planVisible) middle.push(PLAN_ITEM);
  if (transactionsEnabled) middle.push(TRANSACTIONS_ITEM);
  const items: NavItem[] = [...middle, ...SIGNED_IN_ITEMS.slice(-1)]; // + Settings

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
