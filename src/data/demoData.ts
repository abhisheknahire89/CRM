import { claimIdFor } from "@/domain/aiContract";
import type { AiExtraction } from "@/domain/aiContract";
import type {
  ClaimDefinitionId,
  ClaimSeed,
  ClaimValue,
  Deal,
  EvidenceSource,
  HumanDecision,
  SpeakerRole,
  User,
} from "@/domain/types";

/**
 * Synthetic demo data. Castellan Freight, every account, person and quote is invented
 * (deck slide 3). Castellan values are fixed by PRODUCT_CONTRACT §9.
 *
 * NOTE what is NOT here: no computed status. Statuses are produced by the status engine
 * from the evidence below. Evidence is written in the AI extraction wire format so the
 * prototype and the production design share one AI/policy boundary.
 */

/** Evaluation clock for the demo (the day of the weekly forecast review). */
export const DEMO_NOW = "2026-10-08T09:00:00Z";

export const DEMO_MANAGER_ID = "u-daniel";
export const DEMO_REP_ID = "u-maya";
export const DEMO_REVOPS_ID = "u-priya";

export const demoUsers: User[] = [
  { id: DEMO_MANAGER_ID, name: "Daniel Reyes", role: "MANAGER", title: "Sales Manager, Enterprise" },
  { id: DEMO_REP_ID, name: "Maya Okafor", role: "REP", title: "Account Executive" },
  { id: "u-sam", name: "Sam Whitfield", role: "REP", title: "Account Executive" },
  { id: DEMO_REVOPS_ID, name: "Priya Nair", role: "REVOPS", title: "Revenue Operations" },
];

const SURFACED = "2026-10-07T16:00:00Z"; // rep sees flags the day before the review (I-6)
const ALL_CHANNELS = ["CRM", "EMAIL", "CALENDAR", "CALL_RECORDER"] as const;

const deal = (d: Omit<Deal, "managerId" | "connectedChannels" | "flagsSurfacedToRepAt">): Deal => ({
  ...d,
  managerId: DEMO_MANAGER_ID,
  connectedChannels: [...ALL_CHANNELS],
  flagsSurfacedToRepAt: SURFACED,
});

export const demoDeals: Deal[] = [
  deal({ id: "castellan-freight", accountName: "Castellan Freight", valueUsd: 186_000, forecastCategory: "COMMIT", closeDate: "2026-10-15", ownerRepId: DEMO_REP_ID }),
  deal({ id: "tessera-foods", accountName: "Tessera Foods", valueUsd: 310_000, forecastCategory: "COMMIT", closeDate: "2026-10-22", ownerRepId: "u-sam" }),
  deal({ id: "halden-marine", accountName: "Halden Marine", valueUsd: 92_000, forecastCategory: "BEST_CASE", closeDate: "2026-11-12", ownerRepId: "u-sam" }),
  deal({ id: "pellam-industrial", accountName: "Pellam Industrial", valueUsd: 64_000, forecastCategory: "BEST_CASE", closeDate: "2026-10-25", ownerRepId: "u-sam" }),
  deal({ id: "brightwater-logistics", accountName: "Brightwater Logistics", valueUsd: 240_000, forecastCategory: "COMMIT", closeDate: "2026-10-30", ownerRepId: DEMO_REP_ID }),
  deal({ id: "ormond-health", accountName: "Ormond Health", valueUsd: 128_000, forecastCategory: "BEST_CASE", closeDate: "2026-11-30", ownerRepId: DEMO_REP_ID }),
  // All four claims supported: correctly absent from the review queue.
  deal({ id: "vantor-cargo", accountName: "Vantor Cargo", valueUsd: 150_000, forecastCategory: "COMMIT", closeDate: "2026-10-20", ownerRepId: DEMO_REP_ID }),
];

// ── Claims the CRM asserts (seeds; the engine computes their status) ─────────

const seed = (dealId: string, definitionId: ClaimDefinitionId, crmValue: ClaimValue): ClaimSeed => ({
  id: claimIdFor(dealId, definitionId),
  dealId,
  definitionId,
  crmValue,
});

const claimsFor = (dealId: string, close: string, procurementWeeks: number | null): ClaimSeed[] => [
  seed(dealId, "BUDGET_CONFIRMED", true),
  seed(dealId, "SECURITY_COMPLETE", true),
  seed(dealId, "PROCUREMENT_DURATION", procurementWeeks),
  seed(dealId, "CLOSE_DATE", close),
];

export const demoClaimSeeds: ClaimSeed[] = [
  ...claimsFor("castellan-freight", "2026-10-15", 2),
  ...claimsFor("tessera-foods", "2026-10-22", 2),
  ...claimsFor("halden-marine", "2026-11-12", 2),
  ...claimsFor("pellam-industrial", "2026-10-25", 2),
  ...claimsFor("brightwater-logistics", "2026-10-30", 3),
  ...claimsFor("ormond-health", "2026-11-30", null), // CRM asserts no procurement duration
  ...claimsFor("vantor-cargo", "2026-10-20", 2),
];

// ── Sources + AI extractions ─────────────────────────────────────────────────

export const demoSources: EvidenceSource[] = [];
export const demoExtractions: AiExtraction[] = [];

const MODEL = "extractor-demo-0.1";
const PROMPT = "claims-v0.1";

interface Person {
  name: string;
  role: SpeakerRole;
}
interface Hit {
  id: string;
  dealId: string;
  def: ClaimDefinitionId;
  at: string;
  quote: string;
  value: ClaimValue;
  conf: number;
  conflicts?: string[];
}

function addEmail(
  hit: Hit,
  from: Person,
  rep: string,
  subject: string,
  before: string[],
  after: string[],
) {
  const sourceId = `src-${hit.id}`;
  demoSources.push({
    id: sourceId,
    dealId: hit.dealId,
    type: "CUSTOMER_EMAIL",
    title: subject,
    occurredAt: hit.at,
    participants: [from, { name: rep, role: "SELLER_REP" }],
    text: [`From: ${from.name}`, `To: ${rep}`, `Subject: ${subject}`, "", `Hi ${rep.split(" ")[0]},`, ...before, hit.quote, ...after, "", `Best,`, from.name]
      .join("\n"),
    deepLink: `https://mail.example/t/${sourceId}`,
  });
  push(hit, sourceId, "CUSTOMER_EMAIL", from);
}

function push(hit: Hit, sourceId: string, type: AiExtraction["source_type"], who: Person) {
  demoExtractions.push({
    extraction_id: hit.id,
    deal_id: hit.dealId,
    claim_definition: hit.def,
    source_id: sourceId,
    source_type: type,
    quote: hit.quote,
    speaker: who.name,
    speaker_role_candidate: who.role,
    timestamp: hit.at,
    structured_value: hit.value,
    extraction_confidence: hit.conf,
    candidate_conflicts: hit.conflicts ?? [],
    model_version: MODEL,
    prompt_version: PROMPT,
  });
}

// ─ Castellan Freight (canonical; PRODUCT_CONTRACT §9) ─

const MAYA = "Maya Okafor";
const ELENA: Person = { name: "Elena Voss", role: "CFO" };
const MARCUS: Person = { name: "Marcus Lindqvist", role: "CHAMPION" };
const HANNAH: Person = { name: "Hannah Brandt", role: "PROCUREMENT" };
const MAYA_P: Person = { name: MAYA, role: "SELLER_REP" };

// Claim 1: Budget. CFO email, 17 Sep.
addEmail(
  { id: "ex-cf-budget", dealId: "castellan-freight", def: "BUDGET_CONFIRMED", at: "2026-09-17T14:05:00Z", quote: "Budget for the rollout is approved for Q4.", value: true, conf: 0.97 },
  ELENA, MAYA, "RE: Castellan rollout - commercial next steps",
  ["Thanks for the walkthrough on Monday. The team found it useful."],
  ["Please send the order form to Hannah Brandt in procurement once your legal team has the final draft."],
);

// Claim 2: Security. Rep note only.
demoSources.push({
  id: "src-cf-security-note",
  dealId: "castellan-freight",
  type: "CRM_NOTE",
  title: "Rep note on Castellan Freight",
  occurredAt: "2026-09-24T11:30:00Z",
  participants: [MAYA_P],
  text: "Rep note, 24 Sep (Maya Okafor)\n\nSent the security questionnaire to Castellan IT on the 18th. Security should be fine. Will chase for the signed-off review.",
  deepLink: "https://crm.example/notes/cf-security-0924",
});
push(
  { id: "ex-cf-security-note", dealId: "castellan-freight", def: "SECURITY_COMPLETE", at: "2026-09-24T11:30:00Z", quote: "Security should be fine.", value: true, conf: 0.9 },
  "src-cf-security-note", "CRM_NOTE", MAYA_P,
);

// Claim 3: Procurement. Champion call, then a later procurement email.
demoSources.push({
  id: "src-cf-call-champion",
  dealId: "castellan-freight",
  type: "CALL_TRANSCRIPT",
  title: "Weekly sync with Marcus Lindqvist",
  occurredAt: "2026-09-22T15:00:00Z",
  participants: [MARCUS, MAYA_P],
  text: [
    "[00:12:31] Maya Okafor: On the commercial side, how long does procurement usually run once the contract is over to you?",
    "[00:12:44] Marcus Lindqvist: Procurement usually takes about two weeks.",
    "[00:12:49] Marcus Lindqvist: Once legal is done, we send the document set across to Hannah's team.",
    "[00:13:02] Maya Okafor: Understood. I'll get the legal draft over to you this week.",
  ].join("\n"),
  deepLink: "https://recorder.example/calls/cf-0922#t=764",
});
push(
  { id: "ex-cf-proc-champion", dealId: "castellan-freight", def: "PROCUREMENT_DURATION", at: "2026-09-22T15:12:44Z", quote: "Procurement usually takes about two weeks.", value: 2, conf: 0.99 },
  "src-cf-call-champion", "CALL_TRANSCRIPT", MARCUS,
);
addEmail(
  { id: "ex-cf-proc-email", dealId: "castellan-freight", def: "PROCUREMENT_DURATION", at: "2026-10-02T10:14:00Z", quote: "Our standard procurement review is four weeks after receipt of the complete document set.", value: 4, conf: 0.96, conflicts: ["ex-cf-proc-champion"] },
  HANNAH, MAYA, "Castellan - vendor onboarding and procurement steps",
  ["Marcus passed along your note, so I'm picking this up for procurement."],
  ["Please send the full set (order form, DPA and security responses) to this address."],
);
// Claim 4: Close date: no customer evidence. (Deliberately no extraction.)

// ─ Tessera Foods ─ (Commit · budget ✓ · security ✓ · procurement ? · close date contradicted)
const RUTH: Person = { name: "Ruth Adeyemi", role: "CFO" };
const INES: Person = { name: "Ines Duarte", role: "CUSTOMER_SECURITY" };
const PAOLO: Person = { name: "Paolo Ricci", role: "SIGNER" };
addEmail({ id: "ex-tf-budget", dealId: "tessera-foods", def: "BUDGET_CONFIRMED", at: "2026-09-09T09:20:00Z", quote: "The Q4 budget for this project is approved.", value: true, conf: 0.95 }, RUTH, "Sam Whitfield", "Tessera - budget sign-off", ["Confirming where we are."], []);
addEmail({ id: "ex-tf-security", dealId: "tessera-foods", def: "SECURITY_COMPLETE", at: "2026-09-30T13:42:00Z", quote: "Our security review is complete and we have no open findings.", value: true, conf: 0.97 }, INES, "Sam Whitfield", "RE: Tessera security questionnaire", ["Thanks for the responses."], []);
addEmail({ id: "ex-tf-close", dealId: "tessera-foods", def: "CLOSE_DATE", at: "2026-10-05T16:10:00Z", quote: "We are targeting signature by 12 November, after the board meeting.", value: "2026-11-12", conf: 0.94 }, PAOLO, "Sam Whitfield", "Tessera - timing", ["On timing:"], []);

// ─ Brightwater Logistics ─ (Commit · budget stale · procurement ✓ · security ✓ · close date unsupported)
const GIDEON: Person = { name: "Gideon Marsh", role: "CFO" };
const AIKO: Person = { name: "Aiko Tan", role: "CUSTOMER_SECURITY" };
const LENA: Person = { name: "Lena Fischer", role: "PROCUREMENT" };
addEmail({ id: "ex-bw-budget", dealId: "brightwater-logistics", def: "BUDGET_CONFIRMED", at: "2026-07-12T10:05:00Z", quote: "We have set aside the budget for this project.", value: true, conf: 0.93 }, GIDEON, MAYA, "Brightwater - next steps after demo", ["Following up on the demo."], []);
addEmail({ id: "ex-bw-security", dealId: "brightwater-logistics", def: "SECURITY_COMPLETE", at: "2026-09-28T14:00:00Z", quote: "The security review is complete, with no open findings.", value: true, conf: 0.96 }, AIKO, MAYA, "RE: Brightwater security review", ["Update from our side:"], []);
addEmail({ id: "ex-bw-proc", dealId: "brightwater-logistics", def: "PROCUREMENT_DURATION", at: "2026-10-01T09:30:00Z", quote: "Our procurement process runs about three weeks from receipt of the contract.", value: 3, conf: 0.95 }, LENA, MAYA, "Brightwater - procurement timeline", ["Answering your question:"], []);

// ─ Halden Marine ─ (Best Case · budget ? · security ? · procurement ✓ · close date ✓)
const OMAR: Person = { name: "Omar Haddad", role: "PROCUREMENT" };
const ISLA: Person = { name: "Isla McKenna", role: "SIGNER" };
addEmail({ id: "ex-hm-proc", dealId: "halden-marine", def: "PROCUREMENT_DURATION", at: "2026-09-29T11:15:00Z", quote: "Our procurement review typically takes two weeks.", value: 2, conf: 0.95 }, OMAR, "Sam Whitfield", "Halden - procurement process", ["Here is how it works on our side."], []);
addEmail({ id: "ex-hm-close", dealId: "halden-marine", def: "CLOSE_DATE", at: "2026-10-05T10:00:00Z", quote: "We plan to sign on 10 November.", value: "2026-11-10", conf: 0.96 }, ISLA, "Sam Whitfield", "RE: Halden - contract timing", ["Thanks for the draft."], []);

// ─ Pellam Industrial ─ (Best Case · budget contradicted by a later CFO email · rest supported)
const YUSUF: Person = { name: "Yusuf Demir", role: "CFO" };
const NADIA: Person = { name: "Nadia Petrov", role: "CUSTOMER_SECURITY" };
const TOBIAS: Person = { name: "Tobias Lund", role: "PROCUREMENT" };
const GRETA: Person = { name: "Greta Sandoval", role: "SIGNER" };
addEmail({ id: "ex-pi-budget-1", dealId: "pellam-industrial", def: "BUDGET_CONFIRMED", at: "2026-09-01T08:45:00Z", quote: "Budget is approved for this purchase.", value: true, conf: 0.95 }, YUSUF, "Sam Whitfield", "Pellam - purchase approval", ["Good news."], []);
addEmail({ id: "ex-pi-budget-2", dealId: "pellam-industrial", def: "BUDGET_CONFIRMED", at: "2026-09-30T15:30:00Z", quote: "Budget for this purchase is on hold pending our Q4 review.", value: false, conf: 0.94, conflicts: ["ex-pi-budget-1"] }, YUSUF, "Sam Whitfield", "RE: Pellam - purchase approval", ["Quick update."], []);
addEmail({ id: "ex-pi-security", dealId: "pellam-industrial", def: "SECURITY_COMPLETE", at: "2026-10-03T12:00:00Z", quote: "We have completed the security review.", value: true, conf: 0.97 }, NADIA, "Sam Whitfield", "Pellam - security review outcome", ["Closing this out."], []);
addEmail({ id: "ex-pi-proc", dealId: "pellam-industrial", def: "PROCUREMENT_DURATION", at: "2026-10-02T09:10:00Z", quote: "Procurement will take two weeks from your signed order form.", value: 2, conf: 0.93 }, TOBIAS, "Sam Whitfield", "Pellam - procurement steps", ["For planning:"], []);
addEmail({ id: "ex-pi-close", dealId: "pellam-industrial", def: "CLOSE_DATE", at: "2026-10-06T10:20:00Z", quote: "We aim to sign by 23 October.", value: "2026-10-23", conf: 0.95 }, GRETA, "Sam Whitfield", "Pellam - signature timing", ["On timing:"], []);

// ─ Ormond Health ─ (Best Case · budget ✓ · security ? · procurement UNKNOWN (CRM blank) · close date ✓)
const MARTA: Person = { name: "Marta Kowalczyk", role: "CFO" };
const BEN: Person = { name: "Ben Okoro", role: "SIGNER" };
addEmail({ id: "ex-oh-budget", dealId: "ormond-health", def: "BUDGET_CONFIRMED", at: "2026-09-21T13:00:00Z", quote: "Funding for this project has been approved.", value: true, conf: 0.96 }, MARTA, MAYA, "Ormond - funding", ["Confirming:"], []);
addEmail({ id: "ex-oh-close", dealId: "ormond-health", def: "CLOSE_DATE", at: "2026-10-02T10:40:00Z", quote: "We expect to sign by the end of November.", value: "2026-11-30", conf: 0.88 }, BEN, MAYA, "RE: Ormond - timeline", ["Timeline from our side:"], []);

// ─ Vantor Cargo ─ (Commit · all four supported → absent from the queue)
const KAI: Person = { name: "Kai Sorensen", role: "CFO" };
const ROSA: Person = { name: "Rosa Almeida", role: "CUSTOMER_SECURITY" };
const DEV: Person = { name: "Dev Anand", role: "PROCUREMENT" };
const LIV: Person = { name: "Liv Haugen", role: "SIGNER" };
addEmail({ id: "ex-vc-budget", dealId: "vantor-cargo", def: "BUDGET_CONFIRMED", at: "2026-09-14T09:00:00Z", quote: "The budget for this deployment is approved.", value: true, conf: 0.97 }, KAI, MAYA, "Vantor - budget", ["Confirming:"], []);
addEmail({ id: "ex-vc-security", dealId: "vantor-cargo", def: "SECURITY_COMPLETE", at: "2026-09-25T10:00:00Z", quote: "Our security team has signed off on the review.", value: true, conf: 0.96 }, ROSA, MAYA, "Vantor - security sign-off", ["Update:"], []);
addEmail({ id: "ex-vc-proc", dealId: "vantor-cargo", def: "PROCUREMENT_DURATION", at: "2026-09-30T14:00:00Z", quote: "Procurement usually completes within two weeks.", value: 2, conf: 0.94 }, DEV, MAYA, "Vantor - procurement", ["For planning:"], []);
addEmail({ id: "ex-vc-close", dealId: "vantor-cargo", def: "CLOSE_DATE", at: "2026-10-06T09:00:00Z", quote: "We will sign on 19 October.", value: "2026-10-19", conf: 0.97 }, LIV, MAYA, "Vantor - signing date", ["Confirming:"], []);

// ── Seeded human decisions ───────────────────────────────────────────────────
// One rep response already exists on Castellan: the rep saw the flags first (I-6).
export const demoDecisions: HumanDecision[] = [
  {
    id: "dec-seed-1",
    dealId: "castellan-freight",
    claimId: claimIdFor("castellan-freight", "SECURITY_COMPLETE"),
    decisionType: "VERIFY_WITH_CUSTOMER",
    value: "Verify with customer",
    reason: "Asking Castellan IT for the signed-off security review this week.",
    userId: DEMO_REP_ID,
    createdAt: "2026-10-07T17:20:00Z",
  },
];
