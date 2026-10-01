import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { CreditFooter } from "@/components/layout/CreditFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inventory — Bag & Shoes",
  description: "Internal inventory and sales management system",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-bg text-text">
        <CreditFooter />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
