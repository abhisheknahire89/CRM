"use client";

import Link from "next/link";
import { useState } from "react";
import { FORECAST_LABEL, ROLE_LABEL, STATUS_LABEL, formatDate, formatDateTime, formatClaimValue, formatUsd } from "@/domain/format";
import type { ConnectedChannel, UserRole } from "@/domain/types";
import { routes } from "@/lib/routes";
import { useRepoQuery } from "@/lib/useRepository";
import type { ClaimEntry, DealLedger } from "@/services/evidenceRepository";
import { DecisionNote, Quote, sourceSummary } from "./evidenceParts";
import { HumanActionModal } from "./HumanActionModal";
import { Button, Card, Eyebrow, LinkButton, PriorityChip, Skeleton, StatusBadge, cx, statusBar } from "./ui";

const CHANNEL_LABEL: Record<ConnectedChannel, string> = {
  CRM: "CRM",
  EMAIL: "Email",
  CALENDAR: "Calendar",
  CALL_RECORDER: "Call recorder",
};

export function DealLedgerScreen({ dealId, role }: { dealId: string; role: Exclude<UserRole, "REVOPS"> }) {
  const { data: ledger, loading } = useRepoQuery((r) => r.getDealLedger(dealId), `deal-${dealId}`);
  const [deciding, setDeciding] = useState(false);
  const isRep = role === "REP";

  if (loading) return <Skeleton label="Loading the deal" />;
  if (!ledger) return <p className="text-slate">This deal is not in the prototype data.</p>;

  const { deal, counts } = ledger;
  const flagged = counts.UNSUPPORTED + counts.CONTRADICTED;
  const repAnswered = new Set(
    ledger.allDecisions.filter((d) => d.claimId && ledger.users[d.userId]?.role === "REP").map((d) => d.claimId),
  );
  const flaggedAnswered = ledger.claims.filter((c) => ["UNSUPPORTED", "CONTRADICTED"].includes(c.claim.computedStatus) && repAnswered.has(c.claim.id)).length;
  const managerDecision = ledger.allDecisions.find((d) => ledger.users[d.userId]?.role === "MANAGER");
  const decidedClaim = managerDecision?.claimId ? ledger.claims.find((c) => c.claim.id === managerDecision.claimId) : undefined;

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href={routes.queue(role)} className="font-semibold text-accent hover:underline">
          ← {isRep ? "Your flags" : "Evidence queue"}
        </Link>
      </nav>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <Eyebrow>{isRep ? "Your deal · checked before the review" : "Deal evidence"}</Eyebrow>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">{deal.accountName}</h1>
            <dl className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
              <Fact label="Deal value" value={<span className="text-2xl font-bold text-ink">{formatUsd(deal.valueUsd)}</span>} />
              <Fact
                label="Forecast"
                value={
                  <span className="inline-flex items-center gap-2">
                    <span className="rounded border border-ink/30 px-2 py-0.5 text-sm font-bold text-ink" data-testid="forecast">
                      {FORECAST_LABEL[deal.forecastCategory]}
                    </span>
                    <span className="text-xs text-muted">as in your CRM</span>
                  </span>
                }
              />
              <Fact label="Close" value={<span className="text-lg font-bold text-ink">{formatDate(deal.closeDate)}</span>} />
              <Fact label="Rep" value={<span className="text-sm font-semibold text-slate">{ledger.owner.name}</span>} />
              <Fact
                label="Evidence review priority"
                value={
                  <span className="inline-flex flex-col items-start gap-1">
                    <PriorityChip priority={ledger.priority} />
                    <span className="max-w-[210px] text-[11px] leading-tight text-muted" data-testid="priority-note">
                      Based on evidence status only — not a win probability.
                    </span>
                  </span>
                }
              />
            </dl>
          </div>
          <div className="max-w-sm text-sm">
            <Eyebrow>Channels read for this deal</Eyebrow>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {deal.connectedChannels.map((c) => (
                <li key={c} className="rounded border border-line bg-canvas px-2 py-0.5 text-xs font-semibold text-slate">
                  {CHANNEL_LABEL[c]}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-snug text-muted">
              Phone, chat and in-person conversations are not read. “No evidence” means none in these sources.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 border-t border-line-soft pt-5 md:grid-cols-[1fr_auto]">
          <p className="text-[15px] leading-relaxed text-slate" data-testid="forecast-statement">
            <strong className="text-ink">
              {isRep ? "The forecast is the manager's call." : "Forecast is still the manager's judgment."}
            </strong>{" "}
            {flagged} of {ledger.claims.length} deal-critical claims need a look. Unsupported does not mean wrong; it means the assumption is visible. The ledger does not predict whether this deal will close, and it never changes the CRM.
          </p>
          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            <p className="text-xs text-muted">
              {isRep ? "Surfaced to you" : "Rep saw these flags"} <strong className="text-slate">{formatDateTime(deal.flagsSurfacedToRepAt)}</strong>
              <br />
              {flaggedAnswered} of {flagged} flags answered
            </p>
            {!isRep && (
              <Button variant="primary" onClick={() => setDeciding(true)}>
                Log decision
              </Button>
            )}
          </div>
        </div>

        {managerDecision && (
          <div className="mt-4 max-w-xl" data-testid="deal-decision">
            <DecisionNote decision={managerDecision} users={ledger.users} onClaim={decidedClaim ? `${decidedClaim.statement} (${STATUS_LABEL[decidedClaim.claim.computedStatus].toUpperCase()})` : undefined} />
          </div>
        )}
      </Card>

      <section aria-label="Deal-critical claims">
        <h2 className="mb-3 text-lg font-bold text-ink">Deal-critical claims</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {ledger.claims.map((entry) => (
            <ClaimCard key={entry.claim.id} entry={entry} ledger={ledger} role={role} />
          ))}
        </div>
      </section>

      {deciding && <HumanActionModal mode="MANAGER_DECISION" ledger={ledger} onClose={() => setDeciding(false)} />}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}

function ClaimCard({ entry, ledger, role }: { entry: ClaimEntry; ledger: DealLedger; role: UserRole }) {
  const { claim, definition, latestEvidence } = entry;
  const status = claim.computedStatus;
  const href = routes.claim(role, ledger.deal.id, definition.id);
  return (
    <article
      className={cx("flex flex-col rounded-xl border border-line border-l-4 bg-surface p-5", statusBar(status))}
      data-testid={`claim-card-${definition.id}`}
      data-status={status}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{definition.shortLabel}</p>
          <h3 className="mt-0.5 text-lg font-bold leading-snug text-ink">{entry.statement}</h3>
          <p className="mt-0.5 text-sm text-muted">
            CRM says <strong className="text-slate">{formatClaimValue(definition, claim.crmValue)}</strong>
          </p>
        </div>
        <StatusBadge status={status} locked />
      </header>

      <div className="mt-4 space-y-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Source summary</p>
          <p className="mt-0.5 text-[13px] leading-snug text-slate">{sourceSummary(entry.evidence)}</p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Latest evidence</p>
          {latestEvidence ? (
            <div className="mt-1">
              <Quote className="text-sm">{latestEvidence.quote}</Quote>
              <p className="mt-1 text-xs text-muted">
                {latestEvidence.speaker} · {ROLE_LABEL[latestEvidence.speakerRole]} · {formatDate(latestEvidence.timestamp)}
                {latestEvidence.authority === "SELLER_SUPPLIED" && <span className="ml-1 font-semibold text-uns">· seller-supplied, not customer evidence</span>}
              </p>
            </div>
          ) : (
            <p className="mt-1 rounded-lg border border-dashed border-line px-3 py-2 text-[13px] text-muted">
              No customer statement found in connected sources.
            </p>
          )}
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Why this status</p>
          <p className="mt-0.5 text-[13px] leading-snug text-slate" data-testid="claim-reason">
            {claim.explanation.reason}
          </p>
        </div>

        {entry.decisions.length > 0 && (
          <div className="space-y-2" data-testid="claim-decisions">
            {entry.decisions.slice(0, 2).map((d) => (
              <DecisionNote key={d.id} decision={d} users={ledger.users} compact />
            ))}
          </div>
        )}
      </div>

      <footer className="mt-5 flex items-center justify-between gap-3 pt-1">
        {status === "UNSUPPORTED" || status === "CONTRADICTED" ? (
          <p className="text-xs text-muted">
            <span className="font-semibold text-slate">Ask next:</span> {definition.nextQuestion}
          </p>
        ) : (
          <span />
        )}
        <LinkButton href={href} variant="secondary" className="shrink-0">
          Inspect evidence <span aria-hidden>→</span>
        </LinkButton>
      </footer>
    </article>
  );
}
