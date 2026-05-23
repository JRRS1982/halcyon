"use client";

import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { Bar, Brand, Links, NavLink, Spacer } from "./NavBar.styled";

type NavBarProps = {
  signedIn: boolean;
};

// Links visible to signed-in users only. Signed-out users see just the brand
// + the Sign in pill on the right.
const SIGNED_IN_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/budget", label: "Budget" },
] as const;

export function NavBar({ signedIn }: NavBarProps) {
  const pathname = usePathname();

  return (
    <Bar>
      <Brand href="/">Halcyon</Brand>
      {signedIn && (
        <Links>
          {SIGNED_IN_ITEMS.map((item) => (
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
