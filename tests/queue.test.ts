import { describe, expect, it } from "vitest";
import { LocalEvidenceRepository } from "@/services/localEvidenceRepository";
import { DEMO_REP_ID } from "@/data/demoData";
import { needsReview, reviewPriority } from "@/domain/priority";

const counts = (o: Partial<Record<"SUPPORTED" | "UNSUPPORTED" | "CONTRADICTED" | "STALE" | "UNKNOWN", number>>) => ({
  SUPPORTED: 0, UNSUPPORTED: 0, CONTRADICTED: 0, STALE: 0, UNKNOWN: 0, ...o,
});

describe("review queue policy", () => {
  it("only Commit / Best Case with an unsupported or contradicted claim qualify (deck slide 5)", () => {
    expect(needsReview("COMMIT", counts({ UNSUPPORTED: 1 }))).toBe(true);
    expect(needsReview("BEST_CASE", counts({ CONTRADICTED: 1 }))).toBe(true);
    expect(needsReview("PIPELINE", counts({ CONTRADICTED: 3 }))).toBe(false);
    expect(needsReview("COMMIT", counts({ SUPPORTED: 4 }))).toBe(false);
    expect(needsReview("COMMIT", counts({ STALE: 2, SUPPORTED: 2 }))).toBe(false);
  });

  it("priority is deterministic", () => {
    expect(reviewPriority("COMMIT", counts({ CONTRADICTED: 1 }))).toBe("HIGH");
    expect(reviewPriority("COMMIT", counts({ UNSUPPORTED: 2 }))).toBe("HIGH");
    expect(reviewPriority("COMMIT", counts({ UNSUPPORTED: 1 }))).toBe("MEDIUM");
    expect(reviewPriority("BEST_CASE", counts({ CONTRADICTED: 1 }))).toBe("MEDIUM");
    expect(reviewPriority("BEST_CASE", counts({ UNSUPPORTED: 1 }))).toBe("LOW");
  });
});

describe("demo queue", () => {
  it("lists six deals with Castellan first, and hides the fully-supported one", async () => {
    const q = await new LocalEvidenceRepository().getReviewQueue();
    expect(q.items.map((i) => i.deal.accountName)).toEqual([
      "Castellan Freight", "Tessera Foods", "Halden Marine", "Pellam Industrial", "Brightwater Logistics", "Ormond Health",
    ]);
    expect(q.items.map((i) => i.priority)).toEqual(["HIGH", "HIGH", "MEDIUM", "MEDIUM", "MEDIUM", "LOW"]);
    expect(q.hiddenCount).toBe(1);
    expect(q.items.every((i) => ["COMMIT", "BEST_CASE"].includes(i.deal.forecastCategory))).toBe(true);
  });

  it("exercises every status, including STALE and UNKNOWN", async () => {
    const repo = new LocalEvidenceRepository();
    const all = await Promise.all(["brightwater-logistics", "ormond-health", "castellan-freight", "pellam-industrial"].map((d) => repo.getDealLedger(d)));
    const statuses = new Set(all.flatMap((l) => l!.claims.map((c) => c.claim.computedStatus)));
    expect(statuses).toEqual(new Set(["SUPPORTED", "UNSUPPORTED", "CONTRADICTED", "STALE", "UNKNOWN"]));
  });

  it("rep-first: a rep sees only their own flagged deals", async () => {
    const q = await new LocalEvidenceRepository().getReviewQueue({ repId: DEMO_REP_ID });
    expect(q.items.map((i) => i.deal.accountName)).toEqual(["Castellan Freight", "Brightwater Logistics", "Ormond Health"]);
    expect(q.items[0].repResponses).toBe(1); // the seeded security response
  });

  it("RevOps freshness change recomputes status deterministically", async () => {
    const repo = new LocalEvidenceRepository();
    await repo.setFreshnessDays("BUDGET_CONFIRMED", 10);
    const budget = (await repo.getDealLedger("castellan-freight"))!.claims[0];
    expect(budget.claim.computedStatus).toBe("STALE"); // 21 days old
    await repo.setFreshnessDays("BUDGET_CONFIRMED", 60);
    expect((await repo.getDealLedger("castellan-freight"))!.claims[0].claim.computedStatus).toBe("SUPPORTED");
    expect((await repo.getPolicy()).modified).toBe(false);
  });
});
