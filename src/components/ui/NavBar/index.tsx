"use client";

import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { usePathname } from "next/navigation";
import { Bar, Brand, Links, NavLink, Spacer } from "./NavBar.styled";

type NavBarProps = {
  signedIn: boolean;
  transactionsEnabled: boolean;
};

type NavItem = { href: string; label: string };

// Links visible to signed-in users only. Signed-out users see just the brand
// + the Sign in pill on the right. Transactions is opt-in (slotted in before
// Settings) and only appears when the user has enabled the feature.
const SIGNED_IN_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/budget", label: "Budget" },
  { href: "/balance", label: "Balance" },
  { href: "/settings", label: "Settings" },
];

const TRANSACTIONS_ITEM: NavItem = {
  href: "/transactions",
  label: "Transactions",
};

export function NavBar({ signedIn, transactionsEnabled }: NavBarProps) {
  const pathname = usePathname();

  const items = transactionsEnabled
    ? [
        ...SIGNED_IN_ITEMS.slice(0, -1),
        TRANSACTIONS_ITEM,
        ...SIGNED_IN_ITEMS.slice(-1),
      ]
    : SIGNED_IN_ITEMS;

  return (
    <Bar>
      <Brand href="/">Halcyon</Brand>
      {signedIn && (
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
      )}
      <Spacer />
      {signedIn ? (
        <form action={signOut}>
          <Button type="submit">Sign out</Button>
        </form>
      ) : (
        <NavLink href="/sign-in" $active={pathname === "/sign-in"}>
          Sign in
        </NavLink>
      )}
    </Bar>
  );
}
