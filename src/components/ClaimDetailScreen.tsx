"use client";

import Link from "next/link";
import { useState } from "react";
import { DISPOSITION_LABEL, type EvidenceDisposition } from "@/domain/evidenceView";
import { ROLE_LABEL, SOURCE_TYPE_LABEL, STATUS_LABEL, formatClaimValue, formatDate, formatDateTime } from "@/domain/format";
import { ADMISSIBLE_EVIDENCE_TEXT } from "@/domain/policies";
import type { UserRole } from "@/domain/types";
import { routes } from "@/lib/routes";
import { useRepoQuery } from "@/lib/useRepository";
import type { ClaimEntry, DealLedger, EvidenceView } from "@/services/evidenceRepository";
import { DecisionNote, Quote } from "./evidenceParts";
import { HumanActionModal, type ActionMode } from "./HumanActionModal";
import { Button, Card, Eyebrow, Modal, Skeleton, StatusBadge, cx, statusText } from "./ui";

const DEMO_REASON = "Procurement delay can be absorbed; waiting for updated customer timeline.";

export function ClaimDetailScreen({ dealId, definitionId, role }: { dealId: string; definitionId: string; role: Exclude<UserRole, "REVOPS"> }) {
  const { data: ledger, loading } = useRepoQuery((r) => r.getDealLedger(dealId), `deal-${dealId}`);
  const [action, setAction] = useState<ActionMode | null>(null);
  const [viewing, setViewing] = useState<EvidenceView | null>(null);

  if (loading) return <Skeleton label="Loading the evidence" />;
  const entry = ledger?.claims.find((c) => c.definition.id === definitionId);
  if (!ledger || !entry) return <p className="text-slate">This claim is not in the prototype data.</p>;

  const isRep = role === "REP";
  const { claim, definition } = entry;
  const status = claim.computedStatus;
  const x = claim.explanation;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
          <Link href={routes.queue(role)} className="font-semibold text-accent hover:underline">
            {isRep ? "Your flags" : "Evidence queue"}
          </Link>
          <span className="text-muted">/</span>
          <Link href={routes.deal(role, ledger.deal.id)} className="font-semibold text-accent hover:underline">
            {ledger.deal.accountName}
          </Link>
          <span className="text-muted">/</span>
          <span className="text-slate">{definition.shortLabel}</span>
        </nav>
        <ClaimSwitcher ledger={ledger} activeId={definition.id} role={role} />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <Eyebrow>{ledger.deal.accountName} · evidence detail</Eyebrow>
          <h1 className="mt-0.5 text-3xl font-bold tracking-tight text-ink">{entry.statement}</h1>
          <p className="mt-1.5 text-lg font-semibold leading-snug">
            <span className={statusText[status]} data-testid="status-headline">
              {x.headline}
            </span>{" "}
            <span className="text-[15px] font-normal text-slate">
              The CRM says <strong className="font-semibold text-ink">{formatClaimValue(definition, claim.crmValue)}</strong>.
            </span>
          </p>
        </div>
        <StatusBadge status={status} size="lg" locked />
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section aria-label="Evidence">
            <h2 className="mb-2 text-base font-bold text-ink">{entry.evidence.length > 0 ? "Evidence, in order" : "Evidence"}</h2>
            {entry.evidence.length === 0 ? (
              <EmptyEvidence ledger={ledger} entry={entry} />
            ) : (
              <ol className="space-y-0">
                {entry.evidence.map((e, i) => (
                  <li key={e.id}>
                    {i > 0 && <Connector prev={entry.evidence[i - 1]} next={e} />}
                    <EvidenceCard e={e} total={entry.evidence.length} entry={entry} onOpen={() => setViewing(e)} />
                  </li>
                ))}
              </ol>
            )}
          </section>

          <HowDetermined entry={entry} />

          <PeopleDecide ledger={ledger} entry={entry} role={role} onAction={setAction} />
        </div>

        <aside className="space-y-3">
          <Card className="p-4" as="section">
            <Eyebrow>Business status · computed by policy</Eyebrow>
            <p className="mt-2 text-[15px] leading-relaxed text-ink" data-testid="status-reason">
              {x.reason}
            </p>
            <details className="group mt-3 border-t border-line-soft pt-2.5" data-testid="rule-details">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-semibold text-accent hover:underline">
                <span aria-hidden className="inline-block transition-transform group-open:rotate-90">▸</span>
                View rule details
              </summary>
              <dl className="mt-3 space-y-2.5 text-[13px]">
                <Rule label="Accepted authority" value={entry.rule.acceptedAuthorities.map((r) => ROLE_LABEL[r]).join(" › ")} />
                <Rule label="Admissible evidence" value={ADMISSIBLE_EVIDENCE_TEXT[definition.id]} />
                <Rule
                  label="Freshness window"
                  value={`${entry.rule.freshnessDays} days${x.evidenceAgeDays !== null ? ` · newest supporting evidence is ${x.evidenceAgeDays} days old` : ""}`}
                />
                <Rule label="Precedence" value="Later or more authoritative evidence wins" />
                <Rule label="Policy version" value={x.ruleVersion} />
                <Rule label="Computed" value={formatDateTime(claim.lastComputedAt)} />
              </dl>
              <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-xs leading-snug text-slate">
                Deterministic. No model score and no human decision is an input to the business status.
              </p>
            </details>
          </Card>

          <ConfidenceCard entry={entry} />

          {(status === "UNSUPPORTED" || status === "CONTRADICTED" || status === "STALE") && (
            <Card className="p-4" as="section">
              <Eyebrow>Next question to ask</Eyebrow>
              <p className="mt-1.5 text-[15px] font-semibold leading-snug text-ink">{definition.nextQuestion}</p>
              <p className="mt-1.5 text-xs text-muted">Suggested by policy. The ledger will not contact the customer for you.</p>
            </Card>
          )}
        </aside>
      </div>

      {action && (
        <HumanActionModal
          mode={action}
          ledger={ledger}
          entry={entry}
          suggestedReason={action === "MANAGER_DECISION" && definition.id === "PROCUREMENT_DURATION" ? DEMO_REASON : undefined}
          onClose={() => setAction(null)}
        />
      )}
      {viewing && <SourceViewer evidence={viewing} ledger={ledger} onClose={() => setViewing(null)} />}
    </div>
  );
}

// ── "How was this status determined?" (collapsed by default) ─────────────────

function HowDetermined({ entry }: { entry: ClaimEntry }) {
  const n = entry.evidence.length;
  const customer = entry.evidence.filter((e) => e.authority !== "SELLER_SUPPLIED").length;
  const people = entry.decisions.length;
  const status = STATUS_LABEL[entry.claim.computedStatus].toUpperCase();
  const steps = [
    {
      k: "AI interpretation",
      note: "probabilistic",
      t: n === 0 ? "No passage was found for this claim." : `Found ${n} passage${n === 1 ? "" : "s"}, extracted the exact quote${n === 1 ? "" : "s"}, and proposed a speaker and role for each.`,
    },
    {
      k: "Deterministic policy",
      note: "RevOps rules",
      t: `Applied this claim's rule to ${n === 0 ? "no evidence" : `${customer} customer-side passage${customer === 1 ? "" : "s"}${n - customer > 0 ? ` and ${n - customer} seller-supplied item${n - customer === 1 ? "" : "s"}` : ""}`} and computed the business status: ${status}.`,
    },
    {
      k: "Human decision",
      note: "judgement, with a reason",
      t: people === 0 ? "None logged on this claim yet. When one is, it sits beside the business status and never rewrites it." : `${people} decision${people === 1 ? "" : "s"} logged beside the business status. It does not rewrite it.`,
    },
  ];
  return (
    <details className="group rounded-lg border border-line bg-surface px-4 py-2.5" data-testid="how-determined">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-semibold text-slate hover:text-ink">
        <span aria-hidden className="inline-block text-accent transition-transform group-open:rotate-90">▸</span>
        How was this status determined?
      </summary>
      <ol className="mt-3 grid gap-3 border-t border-line-soft pt-3 md:grid-cols-3" aria-label="AI interpretation, deterministic policy, human decision">
        {steps.map((st, i) => (
          <li key={st.k} className="text-[13px] leading-snug text-slate">
            <p className="font-bold text-ink">
              {i + 1}. {st.k} <span className="font-normal text-muted">· {st.note}</span>
            </p>
            <p className="mt-1">{st.t}</p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">AI interprets. Policy computes. People decide. Extraction confidence is never an input to the business status.</p>
    </details>
  );
}

function ClaimSwitcher({ ledger, activeId, role }: { ledger: DealLedger; activeId: string; role: UserRole }) {
  return (
    <nav aria-label="Claims on this deal" className="flex flex-wrap gap-2">
      {ledger.claims.map((c) => (
        <Link
          key={c.claim.id}
          href={routes.claim(role, ledger.deal.id, c.definition.id)}
          aria-current={c.definition.id === activeId ? "page" : undefined}
          className={cx(
            "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold",
            c.definition.id === activeId ? "border-ink bg-ink text-white" : "border-line bg-surface text-slate hover:bg-canvas",
          )}
        >
          {c.definition.shortLabel}
          <StatusDot status={c.claim.computedStatus} onDark={c.definition.id === activeId} />
        </Link>
      ))}
    </nav>
  );
}

function StatusDot({ status, onDark }: { status: ClaimEntry["claim"]["computedStatus"]; onDark: boolean }) {
  const color = { SUPPORTED: "bg-sup", UNSUPPORTED: "bg-uns-edge", CONTRADICTED: "bg-con", STALE: "bg-neu", UNKNOWN: "bg-neu" }[status];
  return <span role="img" aria-label={STATUS_LABEL[status]} className={cx("inline-block h-2.5 w-2.5 rounded-full ring-2", color, onDark ? "ring-white/60" : "ring-white")} />;
}

// ── Evidence ─────────────────────────────────────────────────────────────────

const DISPOSITION_STYLE: Record<EvidenceDisposition, string> = {
  SUPPORTS: "bg-sup-soft text-sup border-sup/30",
  DISAGREES: "bg-con-soft text-con border-con/30",
  SUPERSEDED: "bg-neu-soft text-neu border-neu/30",
  CONTEXT_ONLY: "bg-neu-soft text-neu border-neu/30",
  SELLER_SUPPLIED: "bg-uns-soft text-uns border-uns-edge/40",
};

/** "POLICY TREATMENT": how the policy treats this passage for this claim. Wording only; the ranking logic is unchanged. */
function policyTreatment(e: EvidenceView, entry: ClaimEntry): string {
  if (e.authority === "ACCEPTED") {
    return `Accepted evidence — ${ROLE_LABEL[e.speakerRole]}, rank ${entry.rule.acceptedAuthorities.indexOf(e.speakerRole) + 1} of ${entry.rule.acceptedAuthorities.length}`;
  }
  if (e.authority === "SELLER_SUPPLIED") return "Seller-supplied — never counted as customer evidence";
  return `Context only — ${ROLE_LABEL[e.speakerRole]} is not an accepted authority for ${entry.definition.shortLabel}`;
}

function shortTreatment(e: EvidenceView): string {
  return e.authority === "ACCEPTED" ? "accepted evidence" : e.authority === "SELLER_SUPPLIED" ? "seller-supplied" : "customer context";
}

function EvidenceCard({ e, total, entry, onOpen }: { e: EvidenceView; total: number; entry: ClaimEntry; onOpen: () => void }) {
  const seller = e.authority === "SELLER_SUPPLIED";
  const roleBasis = e.speakerRoleBasis === "AI_PROPOSED" ? "proposed by AI" : e.speakerRoleBasis === "SELLER_ATTACHED" ? "rep" : "corrected by a person";
  return (
    <article className="rounded-xl border border-line bg-surface" data-testid={`evidence-${e.id}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-xs font-bold text-white" aria-label={`Passage ${e.sequence} of ${total}`}>
            {e.sequence}
          </span>
          <p className="text-sm font-bold text-ink">
            {SOURCE_TYPE_LABEL[e.sourceType]} <span className="font-normal text-muted">· {formatDateTime(e.timestamp)}</span>
          </p>
        </div>
        <span className={cx("rounded-full border px-2.5 py-0.5 text-xs font-bold", DISPOSITION_STYLE[e.disposition])}>{DISPOSITION_LABEL[e.disposition]}</span>
      </header>

      <div className="px-4 py-3">
        <Quote className="text-[17px] leading-snug">{e.quote}</Quote>
        <p className="mt-2 text-[13px] text-slate" data-testid={`meta-${e.id}`}>
          <span className="font-semibold text-ink">{e.speaker}</span> · {ROLE_LABEL[e.speakerRole]} ({roleBasis}) · {shortTreatment(e)}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          <span className="font-bold uppercase tracking-wide">Policy treatment</span> {policyTreatment(e, entry)}
        </p>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 rounded-b-xl border-t border-line-soft bg-accent-soft/60 px-4 py-2">
        {seller ? (
          <p className="text-xs text-slate">Seller-side material is never customer evidence, so no extraction confidence is shown for it.</p>
        ) : (
          <p className="text-xs font-bold text-accent" data-testid={`confidence-${e.id}`}>
            AI extraction confidence {Math.round(e.extractionConfidence * 100)}%
          </p>
        )}
        <Button variant="secondary" className="!px-3 !py-1 !text-[13px]" onClick={onOpen} aria-label={`Open source for passage ${e.sequence}`}>
          Open source <span aria-hidden>↗</span>
        </Button>
      </footer>
    </article>
  );
}

function Connector({ prev, next }: { prev: EvidenceView; next: EvidenceView }) {
  const days = Math.max(0, Math.round((Date.parse(next.timestamp) - Date.parse(prev.timestamp)) / 86_400_000));
  const higher = next.authority === "ACCEPTED" && prev.authority !== "ACCEPTED";
  return (
    <div className="flex items-center gap-3 py-1.5 pl-[19px]" aria-hidden>
      <span className="h-5 w-px bg-line" />
      <span className="text-xs font-semibold text-muted">
        ↓ {days} day{days === 1 ? "" : "s"} later
        {higher && <span className="text-ink"> · from a more authoritative source</span>}
      </span>
    </div>
  );
}

function EmptyEvidence({ ledger, entry }: { ledger: DealLedger; entry: ClaimEntry }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface px-5 py-8 text-center" data-testid="empty-evidence">
      <p className="text-base font-bold text-ink">No customer statement found in connected sources</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate">
        The CRM holds {entry.statement.toLowerCase()}, but nothing in {ledger.deal.connectedChannels.length} connected channels supports it. That does not make it wrong. It means it is an assumption.
      </p>
      <p className="mt-3 text-xs text-muted">Channels read: CRM · Email · Calendar · Call recorder. Phone, chat and in-person are not read.</p>
    </div>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3">
      <dt className="font-semibold text-muted">{label}</dt>
      <dd className="text-slate">{value}</dd>
    </div>
  );
}

function ConfidenceCard({ entry }: { entry: ClaimEntry }) {
  const extracted = entry.evidence.filter((e) => e.authority !== "SELLER_SUPPLIED");
  const x = entry.claim.explanation;
  const sup = entry.evidence.find((e) => x.supersededEvidenceIds.includes(e.id));
  return (
    <Card className="p-4" as="section">
      <Eyebrow>Extraction confidence · AI, not the business status</Eyebrow>
      <p className="mt-1 text-xs text-muted">How sure the model is that it read each passage correctly.</p>
      {extracted.length === 0 ? (
        <p className="mt-2 text-sm text-slate">No customer-side passage was extracted for this claim, so there is no confidence to show.</p>
      ) : (
        <ul className="mt-2.5 space-y-2.5">
          {extracted.map((e) => (
            <li key={e.id}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold text-ink">
                  Passage {e.sequence} · {ROLE_LABEL[e.speakerRole]}
                </span>
                <span className="font-bold tabular-nums text-accent">{Math.round(e.extractionConfidence * 100)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line-soft" role="img" aria-label={`Extraction confidence ${Math.round(e.extractionConfidence * 100)} percent`}>
                <div className="h-full rounded-full bg-accent" style={{ width: `${e.extractionConfidence * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[13px] leading-snug text-slate">
        {sup ? (
          <>
            The model was <strong>{Math.round(sup.extractionConfidence * 100)}%</strong> sure that {sup.speaker} said it. The business status is still{" "}
            <strong className={statusText[entry.claim.computedStatus]}>{STATUS_LABEL[entry.claim.computedStatus].toUpperCase()}</strong>.{" "}
          </>
        ) : null}
        <strong>Extraction confidence ≠ business status.</strong>
      </p>
    </Card>
  );
}

// ── People decide ────────────────────────────────────────────────────────────

function PeopleDecide({ ledger, entry, role, onAction }: { ledger: DealLedger; entry: ClaimEntry; role: UserRole; onAction: (m: ActionMode) => void }) {
  const isRep = role === "REP";
  const status = entry.claim.computedStatus;
  const decisions = entry.decisions;
  return (
    <section aria-label="People decide" className="rounded-xl border border-line bg-surface p-4">
      <Eyebrow>People decide</Eyebrow>
      <h2 className="mt-1 text-lg font-bold text-ink">{isRep ? "Your move, before the review" : "Your decision"}</h2>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_1.3fr] md:items-stretch" data-testid="status-vs-decision">
        <div className="rounded-lg border border-line px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Business status</p>
          <div className="mt-2">
            <StatusBadge status={status} locked />
          </div>
          <p className="mt-2 text-xs text-muted">Set by policy. A decision cannot edit it.</p>
        </div>
        <div className="hidden items-center text-xl font-bold text-muted md:flex" aria-hidden>
          ≠
        </div>
        <div className="space-y-2">
          {decisions.length === 0 ? (
            <div className="flex h-full min-h-[84px] items-center rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted">
              {isRep ? "No response logged yet." : "No decision logged on this claim yet."}
            </div>
          ) : (
            decisions.map((d) => <DecisionNote key={d.id} decision={d} users={ledger.users} />)
          )}
        </div>
      </div>
      {decisions.length > 0 && (
        <p className="mt-3 text-[13px] font-semibold text-ink" data-testid="status-unchanged">
          Business status is still {STATUS_LABEL[status].toUpperCase()}. The decision sits beside it.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {isRep ? (
          <>
            <Button variant="primary" onClick={() => onAction("REP_VERIFY")}>
              I’ll verify with the customer
            </Button>
            <Button onClick={() => onAction("REP_DISPUTE")}>Dispute the reading</Button>
            <Button onClick={() => onAction("REP_ATTACH")}>Add seller-supplied context</Button>
            <Button onClick={() => onAction("REP_CRM_FIX")}>I’ll correct the CRM myself</Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => onAction("MANAGER_DECISION")}>
            Log decision
          </Button>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        {isRep
          ? "Logged locally. Nothing is written to the CRM or sent to the customer."
          : "Logged beside the claim. The ledger is read-only: it will not change the forecast in your CRM."}
      </p>
    </section>
  );
}

// ── Source viewer ────────────────────────────────────────────────────────────

function SourceViewer({ evidence, ledger, onClose }: { evidence: EvidenceView; ledger: DealLedger; onClose: () => void }) {
  const source = ledger.sources[evidence.sourceId];
  if (!source) return null;
  const i = source.text.indexOf(evidence.quote);
  const before = i >= 0 ? source.text.slice(0, i) : source.text;
  const after = i >= 0 ? source.text.slice(i + evidence.quote.length) : "";
  return (
    <Modal title="Source" onClose={onClose} wide>
      <div className="space-y-4">
        <div>
          <p className="text-base font-bold text-ink">{source.title}</p>
          <p className="mt-0.5 text-sm text-slate">
            {SOURCE_TYPE_LABEL[source.type]} · {formatDateTime(source.occurredAt)} · {source.participants.map((p) => `${p.name} (${ROLE_LABEL[p.role]})`).join(", ")}
          </p>
        </div>
        <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-canvas p-4 font-sans text-sm leading-relaxed text-slate" data-testid="source-text">
          {before}
          {i >= 0 && <mark className="quote-hit font-semibold text-ink">{evidence.quote}</mark>}
          {after}
        </pre>
        <p className="text-xs leading-relaxed text-muted">
          The highlighted passage is the exact quote the ledger cites. The surrounding text is shown so a conditional or hedged remark is not read out of context.
        </p>
        <div className="rounded-lg border border-line-soft bg-accent-soft px-4 py-3 text-xs">
          <p className="font-bold uppercase tracking-wide text-muted">Deep link to the source (simulated in this prototype)</p>
          <p className="mt-1 break-all font-mono text-[12px] text-slate">{source.deepLink}</p>
        </div>
        <p className="text-xs text-muted">Quoted on {formatDate(evidence.timestamp)} by {evidence.speaker}.</p>
      </div>
    </Modal>
  );
}
