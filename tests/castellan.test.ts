import { describe, expect, it } from "vitest";
import { LocalEvidenceRepository } from "@/services/localEvidenceRepository";
import { CLAIM_DEFINITIONS, DEFAULT_POLICY_RULES } from "@/domain/policies";

/** PRODUCT_CONTRACT §9: the canonical demo. These values must never drift. */
describe("Castellan Freight canonical values", async () => {
  const repo = new LocalEvidenceRepository();
  const ledger = (await repo.getDealLedger("castellan-freight"))!;
  const claim = (id: string) => ledger.claims.find((c) => c.claim.definitionId === id)!;

  it("deal header", () => {
    expect(ledger.deal).toMatchObject({ accountName: "Castellan Freight", valueUsd: 186_000, forecastCategory: "COMMIT", closeDate: "2026-10-15" });
  });

  it("has exactly four claims with the canonical CRM values", () => {
    expect(ledger.claims.map((c) => [c.claim.definitionId, c.claim.crmValue])).toEqual([
      ["BUDGET_CONFIRMED", true],
      ["SECURITY_COMPLETE", true],
      ["PROCUREMENT_DURATION", 2],
      ["CLOSE_DATE", "2026-10-15"],
    ]);
  });

  it("Budget → SUPPORTED, Security → UNSUPPORTED, Procurement → CONTRADICTED, Close date → UNSUPPORTED", () => {
    expect(claim("BUDGET_CONFIRMED").claim.computedStatus).toBe("SUPPORTED");
    expect(claim("SECURITY_COMPLETE").claim.computedStatus).toBe("UNSUPPORTED");
    expect(claim("PROCUREMENT_DURATION").claim.computedStatus).toBe("CONTRADICTED");
    expect(claim("CLOSE_DATE").claim.computedStatus).toBe("UNSUPPORTED");
  });

  it("canonical evidence quotes, speakers and dates", () => {
    const budget = claim("BUDGET_CONFIRMED").evidence;
    expect(budget).toHaveLength(1);
    expect(budget[0]).toMatchObject({ quote: "Budget for the rollout is approved for Q4.", speakerRole: "CFO", sourceType: "CUSTOMER_EMAIL" });
    expect(budget[0].timestamp.slice(0, 10)).toBe("2026-09-17");

    const [champion, procurement] = claim("PROCUREMENT_DURATION").evidence;
    expect(champion).toMatchObject({ quote: "Procurement usually takes about two weeks.", speakerRole: "CHAMPION", sourceType: "CALL_TRANSCRIPT", sequence: 1 });
    expect(procurement).toMatchObject({
      quote: "Our standard procurement review is four weeks after receipt of the complete document set.",
      speakerRole: "PROCUREMENT",
      sourceType: "CUSTOMER_EMAIL",
      sequence: 2,
    });
    expect(Date.parse(procurement.timestamp)).toBeGreaterThan(Date.parse(champion.timestamp));

    expect(claim("SECURITY_COMPLETE").evidence.map((e) => e.quote)).toEqual(["Security should be fine."]);
    expect(claim("CLOSE_DATE").evidence).toHaveLength(0);
  });

  it("reasons match the contract", () => {
    expect(claim("BUDGET_CONFIRMED").claim.explanation.reason).toMatch(/Admissible evidence from Elena Voss \(CFO\)/);
    expect(claim("SECURITY_COMPLETE").claim.explanation.reason).toMatch(/seller-supplied.*not customer evidence/);
    expect(claim("PROCUREMENT_DURATION").claim.explanation.reason).toMatch(/Later, more authoritative procurement evidence disagrees/);
    expect(claim("CLOSE_DATE").claim.explanation.reason).toMatch(/no admissible customer evidence exists in connected sources/);
  });

  it("one-line headlines are produced by policy", () => {
    expect(claim("BUDGET_CONFIRMED").claim.explanation.headline).toBe("Supported by CFO evidence from 17 Sep.");
    expect(claim("SECURITY_COMPLETE").claim.explanation.headline).toBe("Only seller-supplied context. No customer evidence in connected sources.");
    expect(claim("PROCUREMENT_DURATION").claim.explanation.headline).toBe("Later, more authoritative procurement evidence disagrees.");
    expect(claim("CLOSE_DATE").claim.explanation.headline).toBe("No customer evidence in connected sources.");
  });

  it("the four claims do NOT downgrade the deal: forecast stays Commit", () => {
    expect(ledger.deal.forecastCategory).toBe("COMMIT");
    expect(ledger.counts).toMatchObject({ SUPPORTED: 1, UNSUPPORTED: 2, CONTRADICTED: 1, STALE: 0, UNKNOWN: 0 });
    expect(ledger.priority).toBe("HIGH");
  });

  it("rep saw the flags first", () => {
    expect(Date.parse(ledger.deal.flagsSurfacedToRepAt)).toBeLessThan(Date.parse("2026-10-08T09:00:00Z"));
  });
});

describe("catalogue and illustrative policy", () => {
  it("has 5–8 predefined claim definitions", () => {
    expect(CLAIM_DEFINITIONS.length).toBeGreaterThanOrEqual(5);
    expect(CLAIM_DEFINITIONS.length).toBeLessThanOrEqual(8);
  });

  it("matches the deck's illustrative rules (slide 12 / B4)", () => {
    const r = Object.fromEntries(DEFAULT_POLICY_RULES.map((x) => [x.definitionId, x]));
    expect(r.BUDGET_CONFIRMED).toMatchObject({ freshnessDays: 60, acceptedAuthorities: ["CFO", "ECONOMIC_BUYER"] });
    expect(r.SECURITY_COMPLETE).toMatchObject({ freshnessDays: 90, acceptedAuthorities: ["CUSTOMER_SECURITY"] });
    expect(r.PROCUREMENT_DURATION).toMatchObject({ freshnessDays: 30, acceptedAuthorities: ["PROCUREMENT", "LEGAL"] });
    expect(r.CLOSE_DATE).toMatchObject({ freshnessDays: 30, acceptedAuthorities: ["SIGNER", "ECONOMIC_BUYER"] });
    expect(DEFAULT_POLICY_RULES.every((x) => x.illustrative)).toBe(true);
  });
});
