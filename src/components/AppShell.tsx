"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { roleFromPath, routes, CURRENT_USER_ID } from "@/lib/routes";
import { useRepoQuery, useRepository } from "@/lib/useRepository";
import { DEMO_NOW } from "@/data/demoData";
import { formatDateTime } from "@/domain/format";
import type { UserRole } from "@/domain/types";
import { Button, Principle, cx } from "./ui";

const TABS: { role: UserRole; label: string; href: string }[] = [
  { role: "MANAGER", label: "Manager", href: "/" },
  { role: "REP", label: "Rep", href: "/rep/" },
  { role: "REVOPS", label: "RevOps", href: routes.revops },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const role = roleFromPath(pathname);
  const repo = useRepository();
  const { data: users } = useRepoQuery((r) => r.getUsers(), "users");
  const me = users?.find((u) => u.id === CURRENT_USER_ID[role]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 sm:px-8">
          <Link href="/" className="flex flex-col leading-tight">
            <span className="text-[15px] font-bold text-ink">Deal Evidence Ledger</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Evidence-native CRM · prototype</span>
          </Link>

          <nav aria-label="View as" className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs font-semibold uppercase tracking-wide text-muted sm:inline">View as</span>
            <div className="inline-flex rounded-lg border border-line bg-canvas p-0.5" role="group">
              {TABS.map((t) => (
                <Link
                  key={t.role}
                  href={t.href}
                  aria-current={role === t.role ? "page" : undefined}
                  className={cx(
                    "rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors",
                    role === t.role ? "bg-ink text-white" : "text-slate hover:bg-surface",
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </div>
            {me && (
              <span className="hidden text-sm text-slate lg:inline">
                <span className="font-semibold text-ink">{me.name}</span> · {me.title}
              </span>
            )}
          </nav>
        </div>
        <div className="border-t border-line-soft bg-accent-soft">
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-5 gap-y-1 px-5 py-1.5 text-xs text-slate sm:px-8">
            <span>
              <strong className="text-ink">Synthetic data.</strong> Castellan Freight, every account, person and quote is invented.
            </span>
            <span className="hidden md:inline">Evidence as of {formatDateTime(DEMO_NOW)}</span>
            <span className="ml-auto">
              <Button variant="ghost" className="!px-2 !py-0.5 !text-xs" onClick={() => repo.resetDemo()}>
                Reset demo
              </Button>
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 py-8 sm:px-8">{children}</main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs text-muted sm:px-8">
          <span>
            <strong className="text-slate">Read-only.</strong> The ledger never writes to your CRM and never contacts a customer. “No evidence” means no evidence in connected sources.
          </span>
          <Principle />
        </div>
      </footer>
    </div>
  );
}
