import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { StyledComponentsRegistry } from "@/lib/styled";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Halcyon",
  description: "Your Next.js application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <StyledComponentsRegistry>
          <div className="min-h-screen">{children}</div>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
