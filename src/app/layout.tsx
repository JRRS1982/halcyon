import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NavBar } from "@/components/ui/NavBar";
import { StyledComponentsRegistry } from "@/lib/styled";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Halcyon",
  description: "Take control of your financial future.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className={inter.className}>
        <StyledComponentsRegistry>
          <NavBar signedIn={!!user} />
          <div className="min-h-screen">{children}</div>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
