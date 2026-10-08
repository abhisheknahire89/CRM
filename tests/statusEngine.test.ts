import { describe, expect, it } from "vitest";
import { stampEvidence } from "@/domain/statusEngine";
import { DEFAULT_POLICY_RULES, getRule } from "@/domain/policies";
import { compute, raw } from "./helpers";

describe("status computation (PRODUCT_CONTRACT §4)", () => {
  it("SUPPORTED: budget + admissible CFO evidence", () => {
    const x = compute("BUDGET_CONFIRMED", true, [raw("BUDGET_CONFIRMED", { role: "CFO", at: "2026-09-17T14:05:00Z", value: true })]);
    expect(x.status).toBe("SUPPORTED");
    expect(x.reasonCode).toBe("SUPPORTED_ACCEPTED_AUTHORITY");
  });

  it("UNSUPPORTED: security CRM=true with only a seller note", () => {
    const x = compute("SECURITY_COMPLETE", true, [
      raw("SECURITY_COMPLETE", { role: "SELLER_REP", type: "CRM_NOTE", at: "2026-09-24T11:30:00Z", value: true }),
    ]);
    expect(x.status).toBe("UNSUPPORTED");
    expect(x.sellerSuppliedEvidenceIds).toHaveLength(1);
    expect(x.supportingEvidenceIds).toHaveLength(0);
  });

  it("CONTRADICTED: champion says 2 weeks, later procurement email says 4", () => {
    const champion = raw("PROCUREMENT_DURATION", { id: "champ", role: "CHAMPION", type: "CALL_TRANSCRIPT", at: "2026-09-22T15:12:44Z", value: 2, conf: 0.99 });
    const procurement = raw("PROCUREMENT_DURATION", { id: "proc", role: "PROCUREMENT", at: "2026-10-02T10:14:00Z", value: 4, conf: 0.96 });
    const x = compute("PROCUREMENT_DURATION", 2, [champion, procurement]);
    expect(x.status).toBe("CONTRADICTED");
    expect(x.controllingEvidenceId).toBe("proc");
    expect(x.supersededEvidenceIds).toEqual(["champ"]);
    expect(x.reason).toMatch(/^Later, more authoritative procurement evidence disagrees/);
  });

  it("UNSUPPORTED: CRM close date with no customer evidence", () => {
    const x = compute("CLOSE_DATE", "2026-10-15", []);
    expect(x.status).toBe("UNSUPPORTED");
    expect(x.reasonCode).toBe("UNSUPPORTED_NO_ADMISSIBLE_EVIDENCE");
  });

  it("STALE: supporting evidence older than the freshness window", () => {
    const x = compute("BUDGET_CONFIRMED", true, [raw("BUDGET_CONFIRMED", { role: "CFO", at: "2026-07-12T10:05:00Z", value: true })]);
    expect(x.status).toBe("STALE"); // 88 days > 60
    expect(x.evidenceAgeDays).toBe(87);
  });

  it("UNKNOWN: no CRM claim and no evidence", () => {
    const x = compute("PROCUREMENT_DURATION", null, []);
    expect(x.status).toBe("UNKNOWN");
  });

  it("does not treat a CRM value of false/0 as 'no claim'", () => {
    const x = compute("BUDGET_CONFIRMED", false, []);
    expect(x.status).toBe("UNSUPPORTED");
  });

  it("with no CRM claim, admissible evidence still defines the claim (field as a view of evidence)", () => {
    const x = compute("PROCUREMENT_DURATION", null, [raw("PROCUREMENT_DURATION", { role: "PROCUREMENT", at: "2026-10-01T10:00:00Z", value: 3 })]);
    expect(x.status).toBe("SUPPORTED");
  });
});

describe("freshness", () => {
  const evidence = [raw("CLOSE_DATE", { role: "SIGNER", at: "2026-09-08T09:00:00Z", value: "2026-10-10" })]; // exactly 30 days old at NOW

  it("is inclusive at the boundary and stale just past it", () => {
    expect(compute("CLOSE_DATE", "2026-10-15", evidence).status).toBe("SUPPORTED");
    expect(compute("CLOSE_DATE", "2026-10-15", evidence, "2026-10-09T09:00:00Z").status).toBe("STALE");
  });

  it("follows the RevOps-configured window", () => {
    expect(compute("CLOSE_DATE", "2026-10-15", evidence, "2026-10-08T09:00:00Z", 10).status).toBe("STALE");
  });

  it("does not soften a contradiction by age", () => {
    const old = raw("PROCUREMENT_DURATION", { role: "PROCUREMENT", at: "2026-06-01T09:00:00Z", value: 6 });
    expect(compute("PROCUREMENT_DURATION", 2, [old]).status).toBe("CONTRADICTED");
  });
});

describe("authority precedence (later OR more authoritative)", () => {
  it("a later accepted authority overrides an earlier one", () => {
    const x = compute("BUDGET_CONFIRMED", true, [
      raw("BUDGET_CONFIRMED", { role: "CFO", at: "2026-09-01T08:45:00Z", value: true }),
      raw("BUDGET_CONFIRMED", { role: "CFO", at: "2026-09-30T15:30:00Z", value: false }),
    ]);
    expect(x.status).toBe("CONTRADICTED");
  });

  it("a more authoritative disagreement overrides a later, lower-ranked support", () => {
    const x = compute("BUDGET_CONFIRMED", true, [
      raw("BUDGET_CONFIRMED", { role: "CFO", at: "2026-09-20T09:00:00Z", value: false }),
      raw("BUDGET_CONFIRMED", { role: "ECONOMIC_BUYER", at: "2026-10-01T09:00:00Z", value: true }),
    ]);
    expect(x.status).toBe("CONTRADICTED");
  });

  it("an earlier, lower-authority disagreement does not override later, higher-authority support", () => {
    const x = compute("BUDGET_CONFIRMED", true, [
      raw("BUDGET_CONFIRMED", { role: "ECONOMIC_BUYER", at: "2026-09-10T09:00:00Z", value: false }),
      raw("BUDGET_CONFIRMED", { role: "CFO", at: "2026-09-20T09:00:00Z", value: true }),
    ]);
    expect(x.status).toBe("SUPPORTED");
  });

  it("customer context (champion) never outranks procurement, even when it is later", () => {
    const x = compute("PROCUREMENT_DURATION", 2, [
      raw("PROCUREMENT_DURATION", { role: "PROCUREMENT", at: "2026-10-02T10:14:00Z", value: 4 }),
      raw("PROCUREMENT_DURATION", { role: "CHAMPION", at: "2026-10-06T10:00:00Z", value: 2 }),
    ]);
    expect(x.status).toBe("CONTRADICTED");
  });

  it("customer context alone (champion says two weeks) is UNSUPPORTED, not SUPPORTED", () => {
    const x = compute("PROCUREMENT_DURATION", 2, [raw("PROCUREMENT_DURATION", { role: "CHAMPION", at: "2026-09-22T15:12:44Z", value: 2 })]);
    expect(x.status).toBe("UNSUPPORTED");
    expect(x.contextEvidenceIds).toHaveLength(1);
  });
});

describe("value matching", () => {
  it("procurement 'at most' the CRM duration supports; longer contradicts", () => {
    expect(compute("PROCUREMENT_DURATION", 3, [raw("PROCUREMENT_DURATION", { role: "PROCUREMENT", at: "2026-10-01T09:00:00Z", value: 2 })]).status).toBe("SUPPORTED");
    expect(compute("PROCUREMENT_DURATION", 3, [raw("PROCUREMENT_DURATION", { role: "PROCUREMENT", at: "2026-10-01T09:00:00Z", value: 4 })]).status).toBe("CONTRADICTED");
  });

  it("close date: a customer date on or before the CRM date supports; later contradicts", () => {
    const at = "2026-10-05T09:00:00Z";
    expect(compute("CLOSE_DATE", "2026-10-22", [raw("CLOSE_DATE", { role: "SIGNER", at, value: "2026-10-22" })]).status).toBe("SUPPORTED");
    expect(compute("CLOSE_DATE", "2026-10-22", [raw("CLOSE_DATE", { role: "SIGNER", at, value: "2026-11-12" })]).status).toBe("CONTRADICTED");
  });
});

describe("evidence ordering", () => {
  it("stamps sequence by time regardless of input order", () => {
    const rule = getRule(DEFAULT_POLICY_RULES, "PROCUREMENT_DURATION");
    const later = raw("PROCUREMENT_DURATION", { id: "later", role: "PROCUREMENT", at: "2026-10-02T10:14:00Z", value: 4 });
    const earlier = raw("PROCUREMENT_DURATION", { id: "earlier", role: "CHAMPION", at: "2026-09-22T15:12:44Z", value: 2 });
    const stamped = stampEvidence(rule, [later, earlier]);
    expect(stamped.map((e) => [e.id, e.sequence])).toEqual([["earlier", 1], ["later", 2]]);
  });

  it("stamps authority from the rule, not from the model", () => {
    const rule = getRule(DEFAULT_POLICY_RULES, "PROCUREMENT_DURATION");
    const stamped = stampEvidence(rule, [
      raw("PROCUREMENT_DURATION", { role: "CHAMPION", at: "2026-09-22T15:12:44Z", value: 2 }),
      raw("PROCUREMENT_DURATION", { role: "PROCUREMENT", at: "2026-10-02T10:14:00Z", value: 4 }),
      raw("PROCUREMENT_DURATION", { role: "SELLER_REP", type: "CRM_NOTE", at: "2026-10-03T10:14:00Z", value: 2 }),
    ]);
    expect(stamped.map((e) => e.authority)).toEqual(["CUSTOMER_CONTEXT", "ACCEPTED", "SELLER_SUPPLIED"]);
  });
});
