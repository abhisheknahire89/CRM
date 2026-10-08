"use client";

import Link from "next/link";
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { STATUS_DEFINITION, STATUS_LABEL } from "@/domain/format";
import type { ComputedStatus, ReviewPriority } from "@/domain/types";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

// ── Status ───────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<ComputedStatus, { chip: string; dot: string; glyph: string; bar: string }> = {
  SUPPORTED: { chip: "bg-sup-soft text-sup border-sup/30", dot: "bg-sup", glyph: "✓", bar: "border-l-sup" },
  UNSUPPORTED: { chip: "bg-uns-soft text-uns border-uns-edge/40", dot: "bg-uns-edge", glyph: "!", bar: "border-l-uns-edge" },
  CONTRADICTED: { chip: "bg-con-soft text-con border-con/30", dot: "bg-con", glyph: "✕", bar: "border-l-con" },
  STALE: { chip: "bg-neu-soft text-neu border-neu/30", dot: "bg-neu", glyph: "◷", bar: "border-l-neu" },
  UNKNOWN: { chip: "bg-neu-soft text-neu border-neu/30", dot: "bg-neu", glyph: "?", bar: "border-l-neu" },
};

export const statusBar = (s: ComputedStatus) => STATUS_STYLE[s].bar;
export const statusText: Record<ComputedStatus, string> = {
  SUPPORTED: "text-sup",
  UNSUPPORTED: "text-uns",
  CONTRADICTED: "text-con",
  STALE: "text-neu",
  UNKNOWN: "text-neu",
};

export function StatusBadge({ status, size = "md", locked = false }: { status: ComputedStatus; size?: "sm" | "md" | "lg"; locked?: boolean }) {
  const s = STATUS_STYLE[status];
  const sizes = { sm: "text-[11px] px-2 py-0.5 gap-1", md: "text-xs px-2.5 py-1 gap-1.5", lg: "text-sm px-3.5 py-1.5 gap-2" };
  return (
    <span
      className={cx("inline-flex items-center rounded-full border font-bold uppercase tracking-wide whitespace-nowrap", s.chip, sizes[size])}
      title={`${STATUS_LABEL[status]}: ${STATUS_DEFINITION[status]}`}
      data-status={status}
    >
      <span aria-hidden className="font-bold">
        {s.glyph}
      </span>
      {STATUS_LABEL[status]}
      {locked && (
        <span className="sr-only"> (computed by policy)</span>
      )}
    </span>
  );
}

const PRIORITY_STYLE: Record<ReviewPriority, string> = {
  HIGH: "bg-ink text-white border-ink",
  MEDIUM: "bg-accent-soft text-accent border-accent/30",
  LOW: "bg-neu-soft text-neu border-neu/30",
};

export function PriorityChip({ priority }: { priority: ReviewPriority }) {
  return (
    <span className={cx("inline-flex rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide", PRIORITY_STYLE[priority])}>
      {priority === "HIGH" ? "High" : priority === "MEDIUM" ? "Medium" : "Low"}
    </span>
  );
}

// ── Layout atoms ─────────────────────────────────────────────────────────────

export function Card({ children, className, as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" }) {
  return <Tag className={cx("rounded-xl border border-line bg-surface", className)}>{children}</Tag>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-[11px] font-bold uppercase tracking-[0.12em] text-muted", className)}>{children}</p>;
}

type ButtonVariant = "primary" | "secondary" | "ghost";
const BTN: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-[#1a43bd] border-accent",
  secondary: "bg-surface text-ink border-line hover:bg-canvas",
  ghost: "bg-transparent text-accent border-transparent hover:bg-accent-soft",
};

export function Button({ variant = "secondary", className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        BTN[variant],
        className,
      )}
    />
  );
}

export function LinkButton({ href, children, variant = "primary", className }: { href: string; children: ReactNode; variant?: ButtonVariant; className?: string }) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors",
        BTN[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Skeleton({ label = "Loading evidence" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label}…</span>
      <div className="h-8 w-64 animate-pulse rounded bg-line-soft" />
      <div className="h-40 animate-pulse rounded-xl bg-line-soft" />
      <div className="h-40 animate-pulse rounded-xl bg-line-soft" />
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx("w-full rounded-2xl border border-line bg-surface shadow-xl outline-none", wide ? "max-w-3xl" : "max-w-xl")}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line-soft px-6 py-4">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md px-2 py-1 text-lg leading-none text-muted hover:bg-canvas hover:text-ink">
            ×
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/** The three-layer principle, used verbatim. */
export function Principle({ className }: { className?: string }) {
  return (
    <p className={cx("text-xs font-bold tracking-wide text-ink", className)}>
      AI interprets. Policy computes. People decide.
    </p>
  );
}
