import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { demoExtractions } from "@/data/demoData";
import { CLAIM_DEFINITIONS, DEFAULT_POLICY_RULES } from "@/domain/policies";
import { STATUS_DEFINITION } from "@/domain/format";
import { LocalEvidenceRepository } from "@/services/localEvidenceRepository";

/**
 * "Everything else must be generated from or checked against the contract."
 * These tests read the markdown deliverables and compare them with the code.
 */
const read = (p: string) => readFileSync(p, "utf8");
const contract = read("docs/PRODUCT_CONTRACT.md");
const eng = read("docs/ENGINEERING_APPROACH.md");
const engHtml = read("engineering-approach.html");
const demo = read("docs/DEMO_SCRIPT.md");
const matrix = read("docs/CONSISTENCY_MATRIX.md");
const readme = read("README.md");
const flat = (s: string) => s.replace(/[*`]/g, "");

const STATUSES = ["SUPPORTED", "UNSUPPORTED", "CONTRADICTED", "STALE", "UNKNOWN"];
const QUOTES = [
  "Budget for the rollout is approved for Q4.",
  "Security should be fine.",
  "Procurement usually takes about two weeks.",
  "Our standard procurement review is four weeks after receipt of the complete document set.",
];
const PRINCIPLE = /AI interprets[.\s·]+Policy computes[.\s·]+People decide/;

describe("contract ↔ code", () => {
  it("the claim catalogue table matches DEFAULT_POLICY_RULES (authority order and freshness)", () => {
    const rows = [...contract.matchAll(/^\| \d \| `(\w+)` \| .*? \| .*? \| (.*?) \| (\d+) days \|$/gm)];
    expect(rows).toHaveLength(CLAIM_DEFINITIONS.length);
    const roleName: Record<string, string> = { CFO: "CFO", ECONOMIC_BUYER: "Economic Buyer", CUSTOMER_SECURITY: "Customer Security", PROCUREMENT: "Procurement", LEGAL: "Legal", SIGNER: "Signer" };
    for (const [, id, authorities, days] of rows) {
      const rule = DEFAULT_POLICY_RULES.find((r) => r.definitionId === id)!;
      expect(rule, id).toBeDefined();
      expect(rule.freshnessDays, id).toBe(Number(days));
      expect(authorities.split(",").map((s) => s.trim()), id).toEqual(rule.acceptedAuthorities.map((r) => roleName[r]));
    }
  });

  it("the Castellan table in the contract matches the engine's output", async () => {
    const ledger = (await new LocalEvidenceRepository().getDealLedger("castellan-freight"))!;
    const expected = { BUDGET_CONFIRMED: "SUPPORTED", SECURITY_COMPLETE: "UNSUPPORTED", PROCUREMENT_DURATION: "CONTRADICTED", CLOSE_DATE: "UNSUPPORTED" } as const;
    const section = contract.slice(contract.indexOf("## 9. Canonical demo"));
    const statusCol = [...section.matchAll(/^\| \d \| .*? \| .*? \| .*? \| \*\*(\w+)\*\* \|/gm)].map((m) => m[1]);
    expect(statusCol).toEqual(Object.values(expected));
    for (const c of ledger.claims) expect(c.claim.computedStatus).toBe(expected[c.definition.id as keyof typeof expected]);
    for (const q of QUOTES) expect(section).toContain(q);
    expect(section).toMatch(/\$186k/);
    expect(section).toMatch(/Forecast \*\*Commit\*\*/);
  });

  it("status definitions in the code match the contract wording", () => {
    for (const s of STATUSES) expect(contract).toContain(`**${s}**`);
    expect(Object.keys(STATUS_DEFINITION)).toEqual(STATUSES);
  });
});

describe("engineering approach ↔ code", () => {
  it("the AI-output JSON examples equal the prototype's extractions, byte for byte", () => {
    const blocks = [...eng.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]));
    for (const id of ["ex-cf-proc-champion", "ex-cf-proc-email"]) {
      const doc = blocks.find((b) => b.extraction_id === id);
      expect(doc, id).toBeDefined();
      expect(doc).toEqual(demoExtractions.find((e) => e.extraction_id === id));
    }
  });

  it("the policy-rule and policy-output JSON match the engine", async () => {
    const blocks = [...eng.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]));
    const rule = blocks.find((b) => b.definitionId === "PROCUREMENT_DURATION")!;
    const code = DEFAULT_POLICY_RULES.find((r) => r.definitionId === "PROCUREMENT_DURATION")!;
    expect(rule).toEqual({ definitionId: code.definitionId, acceptedAuthorities: code.acceptedAuthorities, admissibleSourceTypes: code.admissibleSourceTypes, freshnessDays: code.freshnessDays, version: code.version });

    const out = blocks.find((b) => b.status === "CONTRADICTED")!;
    const x = (await new LocalEvidenceRepository().getDealLedger("castellan-freight"))!.claims.find((c) => c.definition.id === "PROCUREMENT_DURATION")!.claim.explanation;
    for (const k of Object.keys(out)) expect(out[k], k).toEqual((x as unknown as Record<string, unknown>)[k]);
  });

  it("carries the locked scope: statuses, principle, thresholds, read-only", () => {
    const t = flat(eng);
    for (const s of STATUSES) expect(t).toContain(s);
    expect(t).toMatch(PRINCIPLE);
    expect(t).toMatch(/≥ 90 %/);
    expect(t).toMatch(/> 50 %/);
    expect(t).toMatch(/read-only with respect to the external CRM/i);
    expect(t).toMatch(/LLM confidence does not determine status/i);
    expect(t).toMatch(/50 closed deals × about 8 claims ≈ 400/);
    for (const n of ["Salesforce or HubSpot", "Commit", "Best Case", "5–8 predefined claims"]) expect(t).toContain(n);
    for (const e of ["Deal", "ClaimDefinition", "Claim", "Evidence", "PolicyRule", "HumanDecision"]) expect(t).toContain(e);
  });

  it("the not-yet list is identical in contract and engineering (nothing leaks into V1)", () => {
    for (const item of ["Win/loss prediction", "Autonomous emails", "WhatsApp", "Buyer portal", "Custom rules builder", "Relationship graph", "Renewals", "write-back"]) {
      expect(flat(eng).toLowerCase()).toContain(item.toLowerCase());
      expect(flat(contract).toLowerCase()).toContain(item.toLowerCase().replace("win/loss prediction", "win / loss prediction").replace("custom rules builder", "arbitrary / custom rules builder"));
    }
  });

  it("the standalone HTML is generated from the markdown (same sections, same diagram)", () => {
    for (const h of [...eng.matchAll(/^## (.+)$/gm)].map((m) => m[1])) expect(engHtml).toContain(h.replace(/&/g, "&amp;"));
    expect(engHtml).toContain("<svg");
    expect(engHtml).toContain("LLM confidence does not determine status");
  });
});

describe("demo script, matrix and README", () => {
  it("the demo script follows the locked 11-step flow and ends on the closing line", () => {
    for (const q of [QUOTES[2], QUOTES[3]]) expect(demo).toContain(q);
    expect(demo).toContain("The system doesn't make the forecast call. It makes the evidence behind that call inspectable.");
    expect(demo).toMatch(/Keep Forecast = Commit/);
    expect(demo).toMatch(/CONTRADICTED/);
  });

  it("the matrix covers every required concept and never records a mismatch", () => {
    for (const row of [
      "Primary user", "Secondary user", "Buyer", "Champion", "Statuses", "Four Castellan claims", "Forecast remains Commit",
      "AI responsibility", "Policy responsibility", "Human responsibility", "Read-only constraint", "5–8 claims", "Rep-first disclosure",
      "No prediction", "No autonomous customer contact", "No CRM replacement", "MVP integrations", "Human decision log", "Validation metrics",
    ]) expect(matrix, row).toContain(row);
    expect(matrix).not.toMatch(/✗|MISMATCH/);
  });

  it("all docs use the locked principle verbatim", () => {
    for (const [name, doc] of Object.entries({ contract, eng, demo, matrix, readme })) expect(flat(doc), name).toMatch(PRINCIPLE);
  });
});
