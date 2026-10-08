"use client";

import { DECISION_LABEL, ROLE_LABEL, SOURCE_TYPE_LABEL, formatDate, formatDateTime } from "@/domain/format";
import type { HumanDecision, User } from "@/domain/types";
import type { EvidenceView } from "@/services/evidenceRepository";
import { cx } from "./ui";

/** "Champion call (22 Sep) → Procurement email (2 Oct)": the source summary on a claim card. */
export function sourceSummary(evidence: EvidenceView[]): string {
  if (evidence.length === 0) return "No customer evidence in connected sources";
  const label = (e: EvidenceView) => {
    if (e.authority === "SELLER_SUPPLIED") return e.sourceType === "SELLER_ATTACHMENT" ? "Rep-attached note" : "Rep note";
    const kind = e.sourceType === "CALL_TRANSCRIPT" ? "call" : "email";
    return `${ROLE_LABEL[e.speakerRole]} ${kind}`;
  };
  return evidence.map((e) => `${label(e)}, ${formatDate(e.timestamp)}`).join(" → ");
}

export function Quote({ children, className }: { children: string; className?: string }) {
  return (
    <blockquote className={cx("border-l-[3px] border-line pl-3.5 text-[15px] leading-relaxed text-ink", className)}>
      <span aria-hidden>“</span>
      {children}
      <span aria-hidden>”</span>
    </blockquote>
  );
}

const isManagerType = (t: HumanDecision["decisionType"]) =>
  t === "KEEP_FORECAST" || t === "PLAN_FORECAST_CHANGE" || t === "ASK_REP_TO_VERIFY";

function decisionHeadline(d: HumanDecision): string {
  if (d.decisionType === "KEEP_FORECAST") return `Keep Forecast = ${d.value}`;
  if (d.decisionType === "PLAN_FORECAST_CHANGE") return `Plan to move Forecast to ${d.value}`;
  if (d.decisionType === "DISPUTE_INTERPRETATION") return `${DECISION_LABEL[d.decisionType]}: ${d.value.toLowerCase()}`;
  return DECISION_LABEL[d.decisionType];
}

/** A human decision, always rendered as a person's act, visually unlike a computed status. */
export function DecisionNote({ decision, users, compact = false, onClaim }: { decision: HumanDecision; users: Record<string, User>; compact?: boolean; onClaim?: string }) {
  const user = users[decision.userId];
  const manager = isManagerType(decision.decisionType);
  return (
    <div className="rounded-lg border border-dashed border-slate/40 bg-canvas px-3 py-2.5" data-testid="decision-note">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate">
        {manager ? "Manager decision" : "Rep response"} · logged by a person
      </p>
      <p className="mt-1 text-sm font-semibold text-ink">
        {decisionHeadline(decision)}
      </p>
      {onClaim && <p className="mt-0.5 text-xs text-muted">On: {onClaim}. That claim is unchanged.</p>}
      {!compact && <p className="mt-1 text-[13px] leading-snug text-slate">“{decision.reason}”</p>}
      <p className="mt-1 text-xs text-muted">
        {user?.name ?? decision.userId} · {formatDateTime(decision.createdAt)}
      </p>
    </div>
  );
}

export { SOURCE_TYPE_LABEL };
