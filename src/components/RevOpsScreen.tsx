"use client";

import { useState } from "react";
import { ROLE_LABEL } from "@/domain/format";
import { ADMISSIBLE_EVIDENCE_TEXT } from "@/domain/policies";
import type { ClaimDefinition, ClaimDefinitionId, ComputedStatus, PolicyRule } from "@/domain/types";
import { useRepoQuery, useRepository } from "@/lib/useRepository";
import { StatusKey } from "./QueueScreen";
import { Button, Card, Eyebrow, Skeleton, StatusBadge } from "./ui";

/** Claims shown on the demo deals; the other two complete the 5–8 starter set. */
const DEMO_CLAIMS: ClaimDefinitionId[] = ["BUDGET_CONFIRMED", "SECURITY_COMPLETE", "PROCUREMENT_DURATION", "CLOSE_DATE"];

export function RevOpsScreen() {
  const repo = useRepository();
  const { data: policy, loading } = useRepoQuery((r) => r.getPolicy(), "policy");
  const { data: castellan } = useRepoQuery((r) => r.getDealLedger("castellan-freight"), "deal-castellan-freight");

  if (loading || !policy) return <Skeleton label="Loading the policy" />;

  const rows = policy.definitions.map((d) => ({
    def: d,
    rule: policy.rules.find((r) => r.definitionId === d.id)!,
    onCastellan: castellan?.claims.find((c) => c.definition.id === d.id)?.claim.computedStatus,
  }));
  const primary = rows.filter((r) => DEMO_CLAIMS.includes(r.def.id));
  const extra = rows.filter((r) => !DEMO_CLAIMS.includes(r.def.id));

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <Eyebrow>RevOps · setup, then tuning</Eyebrow>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">Evidence policy</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate">
          A simple, predefined policy, not a rules engine. For each claim RevOps decides what counts as evidence, who can give it, and for how long. Policy then computes every status the same way, every time.
        </p>
      </div>

      <div role="note" className="rounded-xl border border-accent/30 bg-accent-soft px-5 py-3 text-sm leading-relaxed text-slate">
        <strong className="text-ink">Illustrative hypotheses.</strong> These authorities and windows are examples to make the idea concrete, to be agreed with a design partner. They are not recommendations.
      </div>

      {policy.modified && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-uns-edge/40 bg-uns-soft px-5 py-3 text-sm text-uns" role="status">
          <span>
            <strong>Policy changed from the illustrative defaults.</strong> Statuses across the ledger have been recomputed.
          </span>
          <Button onClick={() => void repo.restorePolicyDefaults()}>Restore defaults</Button>
        </div>
      )}

      <Card as="section" className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <caption className="sr-only">Predefined claims and their evidence policy</caption>
          <thead>
            <tr className="border-b border-line bg-canvas text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
              <th scope="col" className="px-5 py-3">Claim</th>
              <th scope="col" className="px-3 py-3">Accepted authority</th>
              <th scope="col" className="hidden px-3 py-3 lg:table-cell">Admissible evidence</th>
              <th scope="col" className="px-3 py-3">Fresh for</th>
              <th scope="col" className="px-5 py-3">On Castellan</th>
            </tr>
          </thead>
          <tbody>
            {primary.map((r) => (
              <PolicyRow key={r.def.id} {...r} showEffect />
            ))}
            <tr className="border-y border-line bg-canvas">
              <td colSpan={5} className="px-5 py-2.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">More predefined claims</span>
              </td>
            </tr>
            {extra.map((r) => (
              <PolicyRow key={r.def.id} {...r} showEffect={false} />
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-5" as="section">
        <Eyebrow>What RevOps configures</Eyebrow>
        <ul className="mt-2 space-y-1.5 text-sm text-slate">
          <li>• Which of the predefined claims to inspect (5–8)</li>
          <li>• Which roles are accepted authority, in order</li>
          <li>• How long evidence stays fresh (editable above)</li>
        </ul>
      </Card>

      <StatusKey />
    </div>
  );
}

function PolicyRow({
  def,
  rule,
  onCastellan,
  showEffect,
}: {
  def: ClaimDefinition;
  rule: PolicyRule;
  onCastellan?: ComputedStatus;
  showEffect: boolean;
}) {
  return (
    <tr className="border-b border-line-soft last:border-b-0 align-top">
      <th scope="row" className="px-5 py-4 text-[15px] font-bold text-ink">
        {def.label}
      </th>
      <td className="px-3 py-4">
        <ol className="flex flex-wrap gap-1.5" aria-label="Accepted authority, highest first">
          {rule.acceptedAuthorities.map((r, i) => (
            <li key={r} className="rounded border border-line bg-canvas px-2 py-0.5 text-xs font-semibold text-slate">
              {i + 1}. {ROLE_LABEL[r]}
            </li>
          ))}
        </ol>
      </td>
      <td className="hidden px-3 py-4 text-[13px] leading-snug text-slate lg:table-cell">{ADMISSIBLE_EVIDENCE_TEXT[def.id]}</td>
      <td className="px-3 py-4">
        <FreshnessInput id={def.id} label={def.label} value={rule.freshnessDays} />
      </td>
      <td className="px-5 py-4">
        {showEffect && onCastellan ? <StatusBadge status={onCastellan} size="sm" /> : <span className="text-xs text-muted">Not on Castellan</span>}
      </td>
    </tr>
  );
}

function FreshnessInput({ id, label, value }: { id: ClaimDefinitionId; label: string; value: number }) {
  const repo = useRepository();
  // `draft` is what the user is typing; null means "show the saved value".
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? String(value);

  const commit = () => {
    const n = Number(text);
    if (draft !== null && Number.isFinite(n) && n >= 1) void repo.setFreshnessDays(id, n);
    setDraft(null);
  };
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate">
      <input
        type="number"
        min={1}
        max={365}
        inputMode="numeric"
        value={text}
        aria-label={`Freshness window for ${label}, in days`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="w-20 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-semibold tabular-nums text-ink"
      />
      days
    </label>
  );
}
