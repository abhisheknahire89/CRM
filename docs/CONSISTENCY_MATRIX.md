# Consistency matrix: PPT ↔ prototype ↔ engineering

One product, four artifacts. Every row below was checked against all three columns. **PPT** references are slide numbers in `input/Evidence-native CRM - Abhishek Nahire.pptx` (core slides 1–8, backup B1–B8 = slides 9–16). **Prototype** references are routes, modules or tests. **Engineering** references are sections of [`ENGINEERING_APPROACH.md`](ENGINEERING_APPROACH.md). Locked wording lives in [`PRODUCT_CONTRACT.md`](PRODUCT_CONTRACT.md); judgment calls are in [`DECISIONS.md`](DECISIONS.md).

Principle used everywhere: **AI interprets. Policy computes. People decide.**

| Product concept | PPT | Prototype | Engineering | ✓ |
|---|---|---|---|---|
| **Primary user** | Front-line sales manager (s2, s1 "First user") | Manager role is the default landing (`/`); queue → deal → evidence → decision | §1 "Who it is for"; §5 RBAC (manager sees their reporting line); §6 | ✓ |
| **Secondary user** | Account executive, "rep" (s2) | Rep role (`/rep/…`); Maya Okafor owns Castellan; rep actions on every claim | §1 "Who it is for"; §5 RBAC (rep sees own deals) | ✓ |
| **Buyer** | CRO / VP Sales (s2, s8) | Not a prototype role by design (D-16); the three screens' users are manager, rep, RevOps | §1 "Who it is for"; read-only audit-first entry is the buyer's first purchase (s8) | ✓ |
| **Champion** | **RevOps** is the operational champion (s2). **Champion** is also a customer-side speaker (s3 "Champion said so") | `/revops` is RevOps's screen. Castellan's customer **Champion** is Marcus Lindqvist, role `CHAMPION` | §1 "Who it is for" and the terminology note; §3 example uses `CHAMPION` as a speaker role | ✓ |
| **Statuses** | Supported · Unsupported · Contradicted · Stale · Unknown, with definitions (s4, s7, s12) | `ComputedStatus` in `types.ts`; `STATUS_DEFINITION` in `format.ts`; status key on queue and RevOps | §3 entities; §1 IN table; example output | ✓ |
| **Four Castellan claims** | Budget ✓ Supported, Security Unsupported, Procurement Contradicted, Close Unsupported (s3, s12) | `demoData.ts` + status engine; `tests/castellan.test.ts`; UI regression `tests/ui.test.tsx` | §3 end-to-end example (Procurement); contract §9 | ✓ |
| **Castellan facts** | $186k · Commit · 15 Oct · budget ✓ · security ✓ · procurement 2 weeks (s3) | Deal header and "CRM says" lines; asserted in tests | §3 example ("CRM says 2 weeks") | ✓ |
| **Forecast remains Commit** | "The forecast remains the manager's call. The ledger does not predict" (s3) | Banner "Forecast is still the manager's judgment."; decision *Keep Forecast = Commit* leaves Forecast = Commit and Procurement CONTRADICTED (tested) | §3 step ④; principle 4; §1 NOT YET (autonomous forecasting) | ✓ |
| **Unsupported ≠ false** | "Unsupported does not mean wrong. It means the assumption is visible." (s3) | Same sentence on the deal page; status key footnote | §4 failure handling ("false unsupported" is cheap to correct) | ✓ |
| **AI responsibility** | Interprets: who said what, where and when, which claim, later conflict, extraction confidence (s4) | `AiExtraction` wire format (`aiContract.ts`); extraction confidence and "proposed by AI" role on each passage; strip "AI interprets" | §3 "Who does what"; §3 AI-output JSON (equal to prototype data, tested); §4 | ✓ |
| **Policy responsibility** | Computes status, deterministic, RevOps rules; also review priority and next question (s4, s12) | `statusEngine.ts`, `priority.ts` (shown as **Evidence review priority**, D-25); Business status card; reason text; "Next question to ask" | §2 policy engine; §3 rule + output JSON (equal to engine output, tested) | ✓ |
| **Human responsibility** | Manager's forecast; next question to ask; decision + reason, logged beside the status, never rewrites it (s4, s12) | `HumanActionModal`, decision notes beside the claim; rep actions; test "human decision does not alter status" | §1 principle 4; §3 step ④ | ✓ |
| **Extraction confidence ≠ status** | "Extraction confidence ≠ business status … 99% … still Contradicted" (s4) | Confidence on each passage and in its own card; never in the status badge (UI test); confidence 0.01 vs 0.99 → same status (unit test) | §3 callout "LLM confidence does not determine status"; D-09 | ✓ |
| **Read-only constraint** | "Read-only: no CRM write-back, no customer contact" (s7); "Read-only by design" (s13) | `EvidenceRepository` has no write-to-CRM method; every decision modal and the footer say so; forecast never changes | §1 principle 1; §5 read-only scopes; write-back gated (§7) | ✓ |
| **5–8 claims** | "5–8 predefined claims" (s7, s5) | 6 definitions in `policies.ts` (test: 5 ≤ n ≤ 8); four on deals, two shown on RevOps (D-04) | §1 IN table ("6 in the starter set"); §2 | ✓ |
| **Evidence shown for each claim** | Exact quote and source link, with a status (s7) | Quote, speaker, role, time, source type, authority, sequence, link (source viewer), reason, history | §1 principle 2; §2 extraction output; §3 entities | ✓ |
| **Rep-first disclosure** | "Rep sees flags before the manager" (s7); rep checks "the day before" (s5); B7 | Rep route; "surfaced 7 Oct 16:00, a day before"; manager sees "Rep saw these flags…" and rep responses; seeded rep response (D-14) | §1 IN table; §7 pilot "rep-first"; risk 5 | ✓ |
| **Rep actions** | Inspect source · Dispute reading · Add evidence · Fix CRM manually · Ask the customer (s5) | Open source · Dispute the reading · **Add seller-supplied context** · I'll correct the CRM myself · I'll verify with the customer (all local; nothing is sent or written) | §4 failure handling (dispute, seller-supplied context); §3 audit | ✓ |
| **Manager actions** | Open Castellan · inspect exact source · ask the right question · make the forecast call (s5) | Queue → deal; *Open source*; *Next question to ask*; *Log decision* | §2 UI layer; §3 step ④ | ✓ |
| **Evidence review priority** | Slide 4 lists "Review priority" as a policy output; the ledger "does not predict" (s3) | Named **Evidence review priority** on the queue and deal header, with "Based on evidence status only — not a win probability." (test `ui.test.tsx`) | §3 policy outputs; §1 NOT YET (no win/loss prediction) | ✓ |
| **Seller-supplied context** | Rep can "add evidence"; "marked as seller-supplied" (s5, s13) | Button *Add seller-supplied context*: "Visible to your manager. It does not count as verified customer evidence until confirmed through a connected source."; never admissible (tested) | §4 failure table; §3 `authority = SELLER_SUPPLIED` | ✓ |
| **Evidence detail: first view** | Evidence, source, time, history, uncertainty kept apart (s2, s4) | Leads with status, one-line reason, timeline, and extraction confidence in its own card; rule metadata behind *View rule details*; explainer behind *How was this status determined?* (nothing removed; tested) | §3 "LLM confidence does not determine status" | ✓ |
| **Queue rule** | Manager sees "only priority deals: Commit or Best Case with an unsupported or contradicted claim" (s5) | `needsReview` in `priority.ts`; Vantor Cargo (all supported) is hidden; stale-only does not queue (D-05); tested | §1 IN table (Commit and Best Case) | ✓ |
| **No prediction** | "does not predict whether the deal will close" (s3); win/loss prediction *not yet* (s7) | No score, forecast or probability anywhere; priority is a rule over claim statuses (D-06) | §1 NOT YET; principle 3; §4 ("no win/loss") | ✓ |
| **No autonomous customer contact** | "no customer contact" (s7); autonomous emails *not yet* | "Ask next" is a *question for the human*; "I'll verify" is a log entry; footer says it never contacts a customer | §1 NOT YET; §4 "reaches no customer"; §2 | ✓ |
| **No CRM replacement** | CRM replacement *not yet* (s7); coexists with Salesforce/HubSpot (B1) | Forecast, close date and claim values shown "as in your CRM"; nothing is editable | §1 NOT YET; §2 read-only sources | ✓ |
| **MVP integrations** | Salesforce **or** HubSpot · email + calendar · **one** call recorder (s7) | Channels-read chips per deal: CRM · Email · Calendar · Call recorder; vendor-neutral (D-20) | §1 IN table; §2 data sources, connectors | ✓ |
| **Human decision log** | "Logged beside the status. Never rewrites it." (s4, s12) | Decision stored as `HumanDecision` separately from `Claim`; shown beside the status; persists across reloads | §2 decisions + audit log; §3 `HumanDecision`; §5 audit log | ✓ |
| **RevOps policy** | RevOps sets simple rules: authority, freshness; Budget 60 · Security 90 · Procurement 30 · Close 30 (s12); a simple policy, not arbitrary logic (s5) | `/revops`: same four rows and values, labelled "Illustrative hypotheses"; freshness editable; custom rules *not in V1* | §3 `PolicyRule` and example; §7 week 7 (simple policy settings); risk 4 | ✓ |
| **Platform / failure handling** | B5 failure table; B7 platform risk | Statuses say "in connected sources"; source viewer shows surrounding context; dispute in one step | §4 failure table; §5 platform dependency risk | ✓ |
| **Validation metrics** | ≥ 90 % citations correct and relevant · > 50 % flags worth raising · guardrail: reps don't reject or record less (s7); tests in B3 | Thresholds not shown as product claims; the policy screen and docs call values *proposals* | §1 "Must prove"; §4 evaluation (50 closed deals × ~8 claims ≈ 400); §7 gates | ✓ |
| **Concise engineering artifact** | n/a (deliverable 3) | n/a | `ENGINEERING_APPROACH_CONCISE.md` (six sections) + the full document as the detailed appendix; both tested against the code | ✓ |
| **Top risks** | B5, B7: wrong speaker/role, hidden channels, model mistakes, surveillance, platform risk; B3: does evidence separate outcomes | Statuses say "in connected sources"; role "proposed by AI"; one-step dispute; rep-first | Concise §6 **TOP PRODUCT/TECHNICAL RISKS** (six), full §7 risks (eight) | ✓ |
| **Historical audit** | Value test first (B3, s8 step 1) | n/a (process) | "This tests whether evidence quality separates outcomes enough to justify a live pilot. It does not establish causality." in both documents | ✓ |
| **Order of tests** | Value (historical audit) → accuracy → adoption (B3, s11) | n/a (process) | §7: Gate 0 value (Week 0) → Gate 2 accuracy (Week 8) → Gate 3 adoption (Weeks 9–10) | ✓ |
| **Not yet** | CRM replacement · autonomous emails · win/loss prediction · generic agent · WhatsApp / chat · buyer portal · custom rules engine · relationship graph · renewal product (s7) | Not mentioned anywhere in the product UI; documents only (D-23, D-30) | §1 NOT YET table (identical list); §2 "Not built" | ✓ |
| **Illustrative status** | Castellan, deal and quotes are invented (s1, s3, B2) | "Synthetic data" banner on every screen | Header note and footer of the standalone HTML | ✓ |

## How consistency is enforced, not just claimed

| Check | Where |
|---|---|
| Contract's claim table (authorities, freshness) equals `DEFAULT_POLICY_RULES` | `tests/consistency.test.ts` |
| Contract's Castellan table equals the engine's output; the four canonical quotes are present | `tests/consistency.test.ts`, `tests/castellan.test.ts` |
| The AI-output JSON in the Engineering Approach equals the prototype's extractions, field for field | `tests/consistency.test.ts` |
| The rule and policy-output JSON in the Engineering Approach equal the engine's output | `tests/consistency.test.ts` |
| The standalone HTML is generated from the markdown | `npm run docs:build`; test checks the sections match |
| Principle wording, statuses, thresholds, scope lists appear in every document | `tests/consistency.test.ts` |
| Castellan always renders Budget SUPPORTED · Security UNSUPPORTED · Procurement CONTRADICTED · Close date UNSUPPORTED · Forecast Commit | `tests/ui.test.tsx` |

## Discrepancies found while building, and fixed

I did not explain any away; each was changed at the source.

| Found | Fix |
|---|---|
| First draft of the Engineering Approach never named the buyer or the operational champion | Added §1 "Who it is for" and a terminology note: "champion" means RevOps *and* a customer-side speaker role |
| "Restore defaults" on the RevOps screen also wiped logged decisions | Added a policy-only `restorePolicyDefaults()` to the repository interface |
| The brief's champion quote *agrees* with the CRM, yet the claim is Contradicted. A naive engine would have called Procurement Supported at first | Admissibility requires an accepted authority (D-03); the champion's statement is *context*, shown as *Superseded* |
| Extraction-confidence gating in production vs "confidence is never an input to status" | Clarified: gating may keep a low-confidence *candidate* out of the evidence store (AI layer); policy never reads the score (D-09, contract I-4) |
| Architecture diagram labels sat one arrow off from their layer transitions | Regenerated; the diagram is produced by `scripts/make-architecture-svg.py` |
| RBAC listed an `ADMIN` role that the prototype does not have | Engineering doc now says the prototype implements the three roles; `ADMIN` is a production tenant role for connectors |
