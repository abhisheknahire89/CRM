import { describe, expect, it } from "vitest";
import { computeClaimStatus, stampEvidence } from "@/domain/statusEngine";
import { DEFAULT_POLICY_RULES, getDefinition, getRule } from "@/domain/policies";
import { LocalEvidenceRepository } from "@/services/localEvidenceRepository";
import { DEMO_MANAGER_ID, DEMO_REP_ID } from "@/data/demoData";
import { compute, raw } from "./helpers";

const CF = "castellan-freight";
const PROC = `${CF}:PROCUREMENT_DURATION`;

describe("I-4: extraction confidence is never an input to status", () => {
  it("same evidence at 0.01 and 0.99 confidence yields the same status and reason", () => {
    const mk = (conf: number) => [
      raw("PROCUREMENT_DURATION", { id: "a", role: "CHAMPION", type: "CALL_TRANSCRIPT", at: "2026-09-22T15:12:44Z", value: 2, conf, speaker: "Champion A" }),
      raw("PROCUREMENT_DURATION", { id: "b", role: "PROCUREMENT", at: "2026-10-02T10:14:00Z", value: 4, conf, speaker: "Procurement B" }),
    ];
    const lo = compute("PROCUREMENT_DURATION", 2, mk(0.01));
    const hi = compute("PROCUREMENT_DURATION", 2, mk(0.99));
    expect(lo).toEqual(hi);
    expect(lo.status).toBe("CONTRADICTED");
  });

  it("the 99%-confident champion quote is still part of a CONTRADICTED claim", async () => {
    const repo = new LocalEvidenceRepository();
    const proc = (await repo.getDealLedger(CF))!.claims.find((c) => c.claim.id === PROC)!;
    const champion = proc.evidence.find((e) => e.speakerRole === "CHAMPION")!;
    expect(champion.extractionConfidence).toBe(0.99);
    expect(proc.claim.computedStatus).toBe("CONTRADICTED");
    expect(champion.disposition).toBe("SUPERSEDED");
  });
});

describe("I-3: a human decision never alters computed status", () => {
  it("logging 'Keep Forecast = Commit' leaves every Castellan status and reason unchanged", async () => {
    const repo = new LocalEvidenceRepository();
    const before = await repo.getDealLedger(CF);
    const statusesBefore = before!.claims.map((c) => [c.claim.id, c.claim.computedStatus, c.claim.explanation.reason]);

    await repo.logDecision({
      dealId: CF,
      claimId: PROC,
      decisionType: "KEEP_FORECAST",
      value: "Commit",
      reason: "Procurement delay can be absorbed; waiting for updated customer timeline.",
      userId: DEMO_MANAGER_ID,
    });

    const after = await repo.getDealLedger(CF);
    expect(after!.claims.map((c) => [c.claim.id, c.claim.computedStatus, c.claim.explanation.reason])).toEqual(statusesBefore);
    expect(after!.claims.find((c) => c.claim.id === PROC)!.claim.computedStatus).toBe("CONTRADICTED");
    // ...and the decision is recorded beside the claim
    expect(after!.claims.find((c) => c.claim.id === PROC)!.decisions[0]).toMatchObject({ decisionType: "KEEP_FORECAST", value: "Commit", userId: DEMO_MANAGER_ID });
    // ...and the CRM's forecast is untouched
    expect(after!.deal.forecastCategory).toBe("COMMIT");
  });

  it("every rep action leaves status unchanged too (dispute, verify, CRM fix)", async () => {
    const repo = new LocalEvidenceRepository();
    const before = (await repo.getDealLedger(CF))!.claims.map((c) => c.claim.computedStatus);
    for (const decisionType of ["DISPUTE_INTERPRETATION", "VERIFY_WITH_CUSTOMER", "CRM_CORRECTION_PLANNED"] as const) {
      await repo.logDecision({ dealId: CF, claimId: PROC, decisionType, value: decisionType, reason: "r", userId: DEMO_REP_ID });
    }
    expect((await repo.getDealLedger(CF))!.claims.map((c) => c.claim.computedStatus)).toEqual(before);
  });

  it("computeClaimStatus has no decision parameter (type-level guarantee)", () => {
    const definition = getDefinition("BUDGET_CONFIRMED");
    const rule = getRule(DEFAULT_POLICY_RULES, "BUDGET_CONFIRMED");
    // @ts-expect-error: `decisions` is not an input to the engine
    computeClaimStatus({ definition, rule, crmValue: true, evidence: stampEvidence(rule, []), now: "2026-10-08T09:00:00Z", decisions: [] });
  });
});

describe("I-7: seller-supplied evidence is shown but never admissible", () => {
  it("a rep-attached note labels as seller-supplied and does not move Security off UNSUPPORTED", async () => {
    const repo = new LocalEvidenceRepository();
    const ev = await repo.attachSellerEvidence({ dealId: CF, definitionId: "SECURITY_COMPLETE", note: "Tomas confirmed by phone that the review is done.", userId: DEMO_REP_ID });
    expect(ev.authority).toBe("SELLER_SUPPLIED");
    const security = (await repo.getDealLedger(CF))!.claims.find((c) => c.claim.definitionId === "SECURITY_COMPLETE")!;
    expect(security.claim.computedStatus).toBe("UNSUPPORTED");
    expect(security.evidence.map((e) => e.disposition)).toEqual(["SELLER_SUPPLIED", "SELLER_SUPPLIED"]);
  });
});

describe("I-5: every evidence quote is a verbatim substring of its source", () => {
  it("holds for all demo evidence", async () => {
    const repo = new LocalEvidenceRepository();
    const queue = await repo.getReviewQueue();
    const ids = new Set(queue.items.map((i) => i.deal.id));
    ids.add("vantor-cargo");
    let checked = 0;
    for (const id of ids) {
      const ledger = (await repo.getDealLedger(id))!;
      for (const c of ledger.claims)
        for (const e of c.evidence) {
          expect(ledger.sources[e.sourceId], `source for ${e.id}`).toBeDefined();
          expect(ledger.sources[e.sourceId].text, e.id).toContain(e.quote);
          checked++;
        }
    }
    expect(checked).toBeGreaterThanOrEqual(20);
  });
});
