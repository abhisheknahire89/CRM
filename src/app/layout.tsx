import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { RepositoryProvider } from "@/lib/useRepository";

export const metadata: Metadata = {
  title: "Deal Evidence Ledger · Evidence-native CRM prototype",
  description: "A clickable prototype: before a forecast call, see which deal claims are unsupported, contradicted or stale, with the exact evidence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <RepositoryProvider>
          <AppShell>{children}</AppShell>
        </RepositoryProvider>
      </body>
    </html>
  );
}
