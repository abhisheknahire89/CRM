"use client";

import { useId, useState } from "react";
import { FORECAST_LABEL, STATUS_LABEL } from "@/domain/format";
import type { DecisionType, ForecastCategory } from "@/domain/types";
import { CURRENT_USER_ID } from "@/lib/routes";
import { useRepository } from "@/lib/useRepository";
import type { ClaimEntry, DealLedger } from "@/services/evidenceRepository";
import { Button, Modal, StatusBadge, cx } from "./ui";

export type ActionMode = "MANAGER_DECISION" | "REP_DISPUTE" | "REP_VERIFY" | "REP_CRM_FIX" | "REP_ATTACH";

const NEXT_LOWER: Record<ForecastCategory, ForecastCategory | null> = { COMMIT: "BEST_CASE", BEST_CASE: "PIPELINE", PIPELINE: null };

const DISPUTE_REASONS = [
  "Wrong speaker or role",
  "Out of context",
  "Hedged or conditional, not a commitment",
  "Wrong claim mapped",
  "Something else",
];

interface Props {
  mode: ActionMode;
  ledger: DealLedger;
  /** Required for every mode except a deal-level manager decision. */
  entry?: ClaimEntry;
  /** Prefilled reason for the demo (editable). */
  suggestedReason?: string;
  onClose: () => void;
}

export function HumanActionModal({ mode, ledger, entry, suggestedReason, onClose }: Props) {
  const repo = useRepository();
  const uid = useId();
  const { deal } = ledger;
  const lower = NEXT_LOWER[deal.forecastCategory];

  const [choice, setChoice] = useState<DecisionType>("KEEP_FORECAST");
  const [category, setCategory] = useState(DISPUTE_REASONS[0]);
  const [reason, setReason] = useState(suggestedReason ?? "");
  const [saving, setSaving] = useState(false);

  const claimLabel = entry ? entry.statement : deal.accountName;
  const minLen = mode === "REP_ATTACH" ? 8 : 10;
  const valid = reason.trim().length >= minLen;

  const copy: Record<ActionMode, { title: string; field: string; submit: string; placeholder: string }> = {
    MANAGER_DECISION: {
      title: "Log decision",
      field: "Reason",
      submit: "Log decision",
      placeholder: "Why are you making this call? This reason stays with the decision.",
    },
    REP_DISPUTE: {
      title: "Dispute the reading",
      field: "What did the model get wrong?",
      submit: "Log dispute",
      placeholder: "e.g. Marcus said this about last year's process, not this contract.",
    },
    REP_VERIFY: {
      title: "I'll verify with the customer",
      field: "What will you ask, and of whom?",
      submit: "Log it",
      placeholder: "e.g. Ask Hannah in procurement whether four weeks starts at receipt of the order form.",
    },
    REP_CRM_FIX: {
      title: "I'll correct the CRM myself",
      field: "What will you change?",
      submit: "Log it",
      placeholder: "e.g. Move close date to 12 Nov once procurement confirms.",
    },
    REP_ATTACH: {
      title: "Add seller-supplied context",
      field: "Describe the context",
      submit: "Add seller-supplied context",
      placeholder: "e.g. Tomas (customer security) told me by phone on 7 Oct that the review is done.",
    },
  };
  const c = copy[mode];

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    const userId = CURRENT_USER_ID[mode === "MANAGER_DECISION" ? "MANAGER" : "REP"];
    if (mode === "REP_ATTACH" && entry) {
      await repo.attachSellerEvidence({ dealId: deal.id, definitionId: entry.definition.id, note: reason, userId });
    } else {
      let decisionType: DecisionType;
      let value: string;
      switch (mode) {
        case "MANAGER_DECISION":
          decisionType = choice;
          value =
            choice === "KEEP_FORECAST"
              ? FORECAST_LABEL[deal.forecastCategory]
              : choice === "PLAN_FORECAST_CHANGE" && lower
                ? FORECAST_LABEL[lower]
                : "Rep to verify";
          break;
        case "REP_DISPUTE":
          decisionType = "DISPUTE_INTERPRETATION";
          value = category;
          break;
        case "REP_VERIFY":
          decisionType = "VERIFY_WITH_CUSTOMER";
          value = "Verify with customer";
          break;
        default:
          decisionType = "CRM_CORRECTION_PLANNED";
          value = "Correct the CRM";
      }
      await repo.logDecision({ dealId: deal.id, claimId: entry?.claim.id, decisionType, value, reason, userId });
    }
    onClose();
  }

  return (
    <Modal title={c.title} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-lg bg-canvas px-4 py-3 text-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{entry ? "On this claim" : "On this deal"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{deal.accountName}</span>
            {entry && (
              <>
                <span className="text-muted">·</span>
                <span className="text-slate">{claimLabel}</span>
                <StatusBadge status={entry.claim.computedStatus} size="sm" />
              </>
            )}
          </div>
        </div>

        {mode === "MANAGER_DECISION" && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold text-ink">Decision</legend>
            {(
              [
                ["KEEP_FORECAST", `Keep Forecast = ${FORECAST_LABEL[deal.forecastCategory]}`],
                ...(lower ? ([["PLAN_FORECAST_CHANGE", `Plan to move Forecast to ${FORECAST_LABEL[lower]}`]] as const) : []),
                ["ASK_REP_TO_VERIFY", "Ask the rep to verify before the next review"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={cx(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm",
                  choice === value ? "border-accent bg-accent-soft font-semibold text-ink" : "border-line text-slate hover:bg-canvas",
                )}
              >
                <input type="radio" name={`${uid}-choice`} checked={choice === value} onChange={() => setChoice(value)} className="accent-[#1d4ed8]" />
                {label}
              </label>
            ))}
          </fieldset>
        )}

        {mode === "REP_DISPUTE" && (
          <div>
            <label htmlFor={`${uid}-cat`} className="mb-1 block text-sm font-semibold text-ink">
              Type of problem
            </label>
            <select
              id={`${uid}-cat`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            >
              {DISPUTE_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor={`${uid}-reason`} className="mb-1 block text-sm font-semibold text-ink">
            {c.field}
          </label>
          <textarea
            id={`${uid}-reason`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={c.placeholder}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed placeholder:text-muted/70"
          />
          {suggestedReason && reason === suggestedReason && (
            <p className="mt-1 text-xs text-muted">Prefilled for the demo. Edit freely.</p>
          )}
        </div>

        <div className="rounded-lg border border-line-soft bg-accent-soft px-4 py-3 text-[13px] leading-relaxed text-slate">
          {mode === "REP_ATTACH" ? (
            <>
              <strong className="text-ink">Visible to your manager.</strong> It does not count as verified customer evidence until confirmed through a connected source. When the customer confirms in email or on a call, the evidence is picked up and the business status recomputed.
            </>
          ) : mode === "REP_DISPUTE" ? (
            <>
              <strong className="text-ink">Your manager sees this beside the status.</strong> Saved beside the status. The status itself is set by policy. Nothing is sent to the customer or written to the CRM.
            </>
          ) : entry ? (
            <>
              <strong className="text-ink">Logged beside the business status, not on it.</strong> The business status stays {STATUS_LABEL[entry.claim.computedStatus].toUpperCase()}. A decision never rewrites it.{" "}
              {mode === "MANAGER_DECISION" ? "The ledger is read-only: it will not change the forecast in your CRM." : "Nothing is sent to the customer or written to the CRM."}
            </>
          ) : (
            <>
              <strong className="text-ink">Logged beside the evidence, not on it.</strong> Business statuses do not change. The ledger is read-only: it will not change the forecast in your CRM.
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!valid || saving}>
            {c.submit}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
