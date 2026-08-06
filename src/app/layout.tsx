import { IdleTimeout } from "@/components/auth/IdleTimeout";
import { Footer } from "@/components/ui/Footer";
import { NavBar } from "@/components/ui/NavBar";
import { getNavFlags } from "@/lib/settings/server";
import { StyledComponentsRegistry } from "@/lib/styled";
import { getCurrentUser } from "@/lib/supabase/user";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Balanced Money",
  description:
    "Personal finance, made clear. Track what you have, understand where it goes.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  // One settings read for both nav flags rather than two round-trips.
  const { transactionsEnabled, planVisible } = await getNavFlags(user?.id);

  return (
    <html lang="en">
      <body className={inter.className}>
        <StyledComponentsRegistry>
          <NavBar
            signedIn={!!user}
            transactionsEnabled={transactionsEnabled}
            planVisible={planVisible}
          />
          <div className="app-content">{children}</div>
          <Footer />
          {user && <IdleTimeout />}
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
