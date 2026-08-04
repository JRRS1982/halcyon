import { IdleTimeout } from "@/components/auth/IdleTimeout";
import { Footer } from "@/components/ui/Footer";
import { NavBar } from "@/components/ui/NavBar";
import { isPlanVisible, isTransactionsEnabled } from "@/lib/settings/server";
import { StyledComponentsRegistry } from "@/lib/styled";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const transactionsEnabled = user
    ? await isTransactionsEnabled(user.id)
    : false;
  const planVisible = user ? await isPlanVisible(user.id) : false;

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
