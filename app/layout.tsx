import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { CreditFooter } from "@/components/layout/CreditFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Labash Fashion — Inventory",
  description: "Internal inventory and sales management system",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-text">
        <CreditFooter />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
