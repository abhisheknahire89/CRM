"use client";

import Link from "next/link";
import { DEMO_REP_ID } from "@/data/demoData";
import { FORECAST_LABEL, STATUS_DEFINITION, STATUS_LABEL, formatDate, formatDateTime, formatUsd } from "@/domain/format";
import { getDefinition } from "@/domain/policies";
import type { ComputedStatus, UserRole } from "@/domain/types";
import { routes } from "@/lib/routes";
import { useRepoQuery } from "@/lib/useRepository";
import type { QueueItem } from "@/services/evidenceRepository";
import { Eyebrow, PriorityChip, Skeleton, StatusBadge, cx, LinkButton } from "./ui";

const COUNT_COLOR: Record<"SUPPORTED" | "UNSUPPORTED" | "CONTRADICTED", string> = {
  SUPPORTED: "text-sup",
  UNSUPPORTED: "text-uns",
  CONTRADICTED: "text-con",
};

const GRID = "lg:grid-cols-[minmax(0,2.6fr)_0.8fr_0.9fr_0.8fr_0.9fr_0.9fr_0.9fr_0.9fr_auto]";

export function QueueScreen({ role }: { role: "MANAGER" | "REP" }) {
  const isRep = role === "REP";
  const { data, loading } = useRepoQuery((r) => r.getReviewQueue(isRep ? { repId: DEMO_REP_ID } : undefined), `queue-${role}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <Eyebrow>{isRep ? "Rep · before the review" : "Manager · weekly forecast review · Thu 8 Oct"}</Eyebrow>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">
            {isRep ? "Your flags, before the review" : "Forecast evidence queue"}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate">
            {isRep
              ? `You see these flags first. They were surfaced ${formatDateTime("2026-10-07T16:00:00Z")}, a day before Daniel Reyes's forecast review, so you can check the evidence, dispute a reading or verify with the customer.`
              : "Commit and Best Case deals where a deal-critical claim is unsupported or contradicted. Reps saw their flags yesterday. Every other deal stays out of your way."}
          </p>
        </div>
      </div>

      {loading || !data ? (
        <Skeleton label="Loading the review queue" />
      ) : (
        <section aria-label="Deals needing attention" className="rounded-xl border border-line bg-surface">
          <div className={cx("hidden items-end gap-4 border-b border-line px-5 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted lg:grid", GRID)}>
            <span>Account</span>
            <span>Deal value</span>
            <span>Forecast</span>
            <span>Close</span>
            <span className="text-sup">Supported</span>
            <span className="text-uns">Unsupported</span>
            <span className="text-con">Contradicted</span>
            <span>Evidence review priority</span>
            <span className="w-36" />
          </div>
          <ol>
            {data.items.map((item, i) => (
              <QueueRow key={item.deal.id} item={item} first={i === 0} role={role} />
            ))}
          </ol>
          {data.items.length === 0 && <p className="px-5 py-10 text-center text-slate">Nothing is flagged on your deals.</p>}
          <p className="border-t border-line-soft px-5 py-3 text-xs text-muted">
            <span data-testid="priority-note">Based on evidence status only — not a win probability.</span>{" "}
            {isRep
              ? "Only your own Commit and Best Case deals with an unsupported or contradicted claim are shown."
              : `${data.hiddenCount} Commit / Best Case deal${data.hiddenCount === 1 ? "" : "s"} with every claim supported ${data.hiddenCount === 1 ? "is" : "are"} not shown. Stale claims are shown on each deal but do not queue it on their own.`}
          </p>
        </section>
      )}

      <StatusKey />
    </div>
  );
}

function QueueRow({ item, first, role }: { item: QueueItem; first: boolean; role: UserRole }) {
  const { deal, counts } = item;
  const flagged = item.claims.filter((c) => c.computedStatus === "CONTRADICTED" || c.computedStatus === "UNSUPPORTED");
  const href = routes.deal(role, deal.id);
  const isRep = role === "REP";
  return (
    <li
      className={cx(
        "grid grid-cols-2 items-center gap-x-6 gap-y-3 border-b border-line-soft px-5 py-4 last:border-b-0 lg:gap-x-4 lg:py-5",
        GRID,
        first && "bg-accent-soft/70",
      )}
      data-testid={`queue-row-${deal.id}`}
    >
      <div className="col-span-2 min-w-0 lg:col-span-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={href} className={cx("font-bold text-ink hover:text-accent", first ? "text-xl" : "text-[15px]")}>
            {deal.accountName}
          </Link>
          {first && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Start here</span>}
        </div>
        <p className="mt-1 text-[13px] leading-snug text-slate">
          {item.claims
            .filter((c) => c.computedStatus === "CONTRADICTED" || c.computedStatus === "UNSUPPORTED" || c.computedStatus === "STALE")
            .map((c) => `${getDefinition(c.definitionId).shortLabel} ${STATUS_LABEL[c.computedStatus].toLowerCase()}`)
            .join(" · ")}
        </p>
        <p className="mt-1 text-xs text-muted">
          {!isRep && `${item.owner.name} · `}
          {item.repResponses > 0 ? `Rep has responded to ${item.repResponses} of ${flagged.length} flags` : "Rep has not responded yet"}
          {item.latestDecision && !isRep ? ` · Decision logged: ${item.latestDecision.value}` : ""}
          {item.latestDecision && isRep ? ` · Manager decision logged` : ""}
        </p>
      </div>

      <Cell label="Deal value">
        <span className="font-semibold text-ink">{formatUsd(deal.valueUsd)}</span>
      </Cell>
      <Cell label="Forecast">
        <span className="inline-flex whitespace-nowrap rounded border border-ink/25 px-2 py-0.5 text-xs font-bold text-ink">{FORECAST_LABEL[deal.forecastCategory]}</span>
      </Cell>
      <Cell label="Close">
        <span className="text-slate">{formatDate(deal.closeDate)}</span>
      </Cell>
      <div className="order-5 col-span-2 grid grid-cols-3 gap-3 lg:order-none lg:contents">
        <Count label="Supported" status="SUPPORTED" n={counts.SUPPORTED} />
        <Count label="Unsupported" status="UNSUPPORTED" n={counts.UNSUPPORTED} />
        <Count label="Contradicted" status="CONTRADICTED" n={counts.CONTRADICTED} />
      </div>
      <Cell label="Evidence review priority">
        <PriorityChip priority={item.priority} />
      </Cell>
      <div className="order-6 col-span-2 lg:order-none lg:col-span-1 lg:w-36 lg:text-right">
        <LinkButton href={href} variant={first ? "primary" : "secondary"} className="w-full whitespace-nowrap lg:w-auto">
          {isRep ? "Check evidence" : "Review evidence"} <span aria-hidden>→</span>
        </LinkButton>
      </div>
    </li>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 lg:block">
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted lg:hidden">{label}</span>
      {children}
    </div>
  );
}

function Count({ label, n, status }: { label: string; n: number; status: keyof typeof COUNT_COLOR }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-canvas px-3 py-2 lg:block lg:bg-transparent lg:p-0">
      <span className={cx("text-[11px] font-bold uppercase tracking-wide lg:hidden", COUNT_COLOR[status])}>{label}</span>
      <span className={cx("text-2xl font-bold tabular-nums", n === 0 ? "text-line" : COUNT_COLOR[status])} aria-label={`${n} ${label.toLowerCase()}`}>
        {n}
      </span>
    </div>
  );
}

const KEY: ComputedStatus[] = ["SUPPORTED", "UNSUPPORTED", "CONTRADICTED", "STALE", "UNKNOWN"];

export function StatusKey() {
  return (
    <section aria-label="Status key" className="rounded-xl border border-line-soft bg-surface px-5 py-4">
      <Eyebrow>Status key · computed by policy, never by the model</Eyebrow>
      <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
        {KEY.map((s) => (
          <div key={s} className="space-y-1.5">
            <dt>
              <StatusBadge status={s} size="sm" />
            </dt>
            <dd className="text-[13px] leading-snug text-slate">{STATUS_DEFINITION[s]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted">Unsupported does not mean wrong. It means the assumption is visible.</p>
    </section>
  );
}
