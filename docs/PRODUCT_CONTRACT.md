# Product Contract — Evidence-Native CRM · Deal Evidence Ledger

**Status:** single source of truth. The prototype, the domain code (`src/domain/`), the tests, the Engineering Approach and the Consistency Matrix are all written *from* or checked *against* this file.
**Authority:** the deck `input/Evidence-native CRM - Abhishek Nahire.pptx` is the product strategy. Where this contract adds precision the deck does not state, the choice is logged in [DECISIONS.md](./DECISIONS.md). Nothing here changes the deck.
**Illustrative:** Castellan Freight, every other account, every person, every quote and every threshold below are synthetic hypotheses, as the deck says.

---

## 1. Product, in one paragraph

CRM stores what the team believes. It should also keep what that belief rests on.
**Evidence-native CRM** keeps important deal state as a **claim + evidence + source + time + history + status**. CRM fields become *views* of that layer.
The **first product** is the **Deal Evidence Ledger**: before a forecast call, it shows which important deal claims are **unsupported, contradicted or stale**, with the exact quote and a link to the source.

## 2. Users

| Role | Who | In the product |
|---|---|---|
| **Primary user** | Front-line Sales Manager | Reviews a short list of priority deals at the weekly forecast review; owns the forecast call |
| **Secondary user** | Account Executive (rep) | Sees their own flags *first* (the day before); can inspect, dispute, attach evidence, say "I'll verify with the customer" |
| **Economic buyer** | CRO / VP Sales | Buys a read-only audit first, then the recurring weekly review. Not a prototype role |
| **Operational champion** | RevOps | Owns a simple, predefined policy: which claims, which authority, which freshness window |

Primary recurring workflow: **weekly forecast review**.

*Terminology:* "champion" has two meanings. **RevOps** is the *operational champion* of the product (a user role). **Champion** is also a *customer-side speaker role* in evidence (Castellan's Marcus Lindqvist). They are different people.

## 3. The principle (verbatim, everywhere)

> **AI interprets. Policy computes. People decide.**

| Layer | Nature | Does | Never does |
|---|---|---|---|
| **AI interprets** | Probabilistic | Finds relevant passages in calls/email · extracts the exact quote · identifies the speaker · proposes the speaker's role · maps the evidence to a *predefined* claim · structures dates/durations · flags candidate conflicts with later evidence · returns an **extraction confidence** | Decide the business status · predict win/loss · contact customers · write to the CRM |
| **Policy computes** | Deterministic, RevOps-configured | Computes `SUPPORTED · UNSUPPORTED · CONTRADICTED · STALE · UNKNOWN` from evidence + a simple rule · computes review priority and the next question to ask | Use model confidence as status · accept free-form rules |
| **People decide** | Judgement, with a reason | Forecast judgement · customer communication · adding missing evidence · disputing the AI reading · changing the CRM · exceptions | Rewrite the computed status. A decision is logged **beside** it |

**Fundamental separation:** `Extraction confidence ≠ business status`, and a `HumanDecision` never mutates a `ComputedStatus`.
Example: the model can be 99% confident the champion said "Procurement usually takes about two weeks". The claim is still `CONTRADICTED`, because a later, more authoritative procurement email disagrees.

## 4. Statuses (deterministic definitions)

| Status | Definition |
|---|---|
| **SUPPORTED** | Admissible customer evidence supports the CRM value, nothing later or more authoritative disagrees, and the evidence is within the freshness window |
| **UNSUPPORTED** | The CRM asserts the claim, but no admissible customer evidence exists in connected sources |
| **CONTRADICTED** | Later *or* more authoritative admissible evidence disagrees with the CRM value |
| **STALE** | The supporting evidence is older than the claim's freshness window |
| **UNKNOWN** | The CRM asserts nothing and there is no evidence: nobody has claimed it |

*Unsupported ≠ false.* It means the assumption is visible. The ledger never predicts whether the deal will close.

### 4.1 Admissible evidence

Evidence is **admissible** for a claim only if **all** hold:
1. the source type is customer-side-capable for that rule (`CUSTOMER_EMAIL`, `CALL_TRANSCRIPT`);
2. the speaker is **not** the seller (rep notes, seller attachments and CRM notes are *seller-supplied*, shown but never admissible);
3. the speaker's role is in the rule's **accepted authorities** for that claim;
4. it carries a structured value the policy can compare with the CRM value.

Customer-side evidence from someone who is *not* an accepted authority (for example the champion on procurement) is kept as **context**. It is shown in history, and it can be **superseded**, but it cannot support a claim on its own.

### 4.2 Status algorithm (this is what `statusEngine.ts` implements)

```
1. admissible := evidence filtered by §4.1
2. if admissible is empty:
       return CRM value present ? UNSUPPORTED : UNKNOWN
3. supporting := admissible that "match" the CRM value   (a missing CRM value → everything is supporting)
   disagreeing := admissible that do not
4. best(S) := highest authority rank, then latest timestamp
5. if disagreeing is empty:
       latest supporting older than freshness window ? STALE : SUPPORTED
6. if supporting is empty:                                   return CONTRADICTED
7. d = best(disagreeing), s = best(supporting)
   d overrides s  iff  d is later than s  OR  d has higher authority than s
       overrides ? CONTRADICTED : (supporting-branch of step 5)
```

* **Authority rank** = position in the rule's ordered `acceptedAuthorities` list (earlier = higher).
* **Precedence** = "later or more authoritative" (deck, slide 12).
* **Match modes:** `EQUALS` (boolean), `AT_MOST` (duration in weeks, date no later than the CRM date).
* **Freshness** is measured from the controlling supporting evidence to the evaluation time. A contradiction is not softened by age.
* The function **takes no `HumanDecision` and no model confidence as input**. That is the type-level guarantee.
* **Review priority** and the **next question to ask** are also computed by policy (§8).

## 5. Claim catalogue (RevOps starter set, 6 of the 5–8 allowed)

All settings are **illustrative hypotheses** (deck slide 12 and backup B4). Rows 1–4 are the four Castellan claims.

| # | `ClaimDefinitionId` | Claim | Value kind | Accepted authority (ordered) | Fresh for |
|---|---|---|---|---|---|
| 1 | `BUDGET_CONFIRMED` | Budget confirmed | boolean, `EQUALS` | CFO, Economic Buyer | 60 days |
| 2 | `SECURITY_COMPLETE` | Security review complete | boolean, `EQUALS` | Customer Security | 90 days |
| 3 | `PROCUREMENT_DURATION` | Procurement takes N weeks | weeks, `AT_MOST` | Procurement, Legal | 30 days |
| 4 | `CLOSE_DATE` | Close by `<date>` | date, `AT_MOST` | Signer, Economic Buyer | 30 days |
| 5 | `ECONOMIC_BUYER_ENGAGED` | Economic buyer engaged | boolean, `EQUALS` | Economic Buyer, CFO | 45 days |
| 6 | `LEGAL_REVIEW_STARTED` | Contract in customer legal review | boolean, `EQUALS` | Legal | 30 days |

Rows 5–6 exist only so the catalogue honestly reflects "5–8 claims". They are not shown on Castellan (see D-04).

## 6. Domain entities (`src/domain/types.ts` implements these)

`Deal` · `ClaimDefinition` · `Claim` · `Evidence` · `EvidenceSource` · `PolicyRule` · `ComputedStatus` · `HumanDecision` · `User` · `UserRole`

* **Claim** — `id, dealId, definitionId, crmValue, computedStatus, lastComputedAt` (+ the policy's `StatusExplanation` for audit).
* **Evidence** — `id, claimId, sourceType, sourceId, speaker, speakerRole, timestamp, quote, extractionConfidence, authority, sequence` (+ `structuredValue` the AI structured, and `speakerRoleBasis`).
* **HumanDecision** — `id, dealId, claimId?, decisionType, value, reason, userId, createdAt`.
* `computedStatus` is **never** a field of `HumanDecision`, and `HumanDecision` is never an input to `computeClaimStatus`.

## 7. MVP scope (locked)

**V1 is READ-ONLY with respect to the external CRM.**

| IN | NOT YET (clearly labelled "future" wherever it appears) |
|---|---|
| Reads **Salesforce *or* HubSpot** | CRM replacement / Salesforce replacement |
| Reads **email + calendar** | Generic AI chat assistant / generic agent |
| Reads **one call recorder** | Win / loss prediction · autonomous forecasting |
| Covers **Commit** and **Best Case** deals | Autonomous emails · AI SDR · any customer contact |
| **5–8 predefined claims** | WhatsApp / chat ingestion |
| Shows claim · status · **exact quote** · source · speaker · date/time · evidence history · **reason** · **source link** | Buyer portal |
| **Rep sees flags before the manager** | Arbitrary / custom rules builder |
| Human decision log, stored separately | Relationship graph · renewals · customer success |
| | Autonomous CRM write-back · agent swarm |

Optional expansion *only if validated* (deck slide 8): human-confirmed write-back → some CRM fields derived from evidence → broader customer memory.

**Must prove** (proposed validation thresholds, **not industry benchmarks**):
* **≥ 90 %** of evidence citations are correct and relevant;
* **> 50 %** of surfaced flags are judged worth raising by managers;
* **Guardrail:** reps don't reject it or record less (disputes and recording-avoidance stay low).

## 8. Policy outputs beyond status

* **Review-queue inclusion** (deck slide 5): `forecast ∈ {COMMIT, BEST_CASE}` **and** at least one claim is `UNSUPPORTED` or `CONTRADICTED`. `STALE` is displayed but does not on its own put a deal in the queue (D-05).
* **Review priority** (deterministic):
  * `HIGH` — Commit and (≥ 1 contradicted **or** ≥ 2 unsupported)
  * `MEDIUM` — (Commit and exactly 1 unsupported) **or** (Best Case and (≥ 1 contradicted or ≥ 2 unsupported))
  * `LOW` — everything else in the queue
  * Sort: priority, then flagged claims (contradicted + unsupported) desc, then contradicted desc, then deal value desc.
* **Next question to ask**: a fixed template per `ClaimDefinition`.

## 9. Canonical demo: Castellan Freight (do not vary)

Evaluation clock for the demo: **8 Oct 2026, 09:00 UTC** (`DEMO_NOW`). The rep was shown the flags on **7 Oct**.

**CRM (external, read-only):** Deal value **$186k** · Forecast **Commit** · Close date **15 Oct** · Budget confirmed **true** · Security complete **true** · Procurement **2 weeks**.

| # | Claim | CRM says | Evidence | Status | Reason (policy) |
|---|---|---|---|---|---|
| 1 | Budget confirmed | Yes | CFO email, **17 Sep**: "Budget for the rollout is approved for Q4." | **SUPPORTED** | Admissible evidence from budget authority; within 60 days |
| 2 | Security review complete | Yes | Rep note only: "Security should be fine." | **UNSUPPORTED** | No admissible customer-side security evidence in connected sources |
| 3 | Procurement takes two weeks | 2 weeks | Champion call: "Procurement usually takes about two weeks." → later Procurement email: "Our standard procurement review is four weeks after receipt of the complete document set." | **CONTRADICTED** | Later, more authoritative procurement evidence disagrees |
| 4 | Close by 15 Oct | 15 Oct | None: no customer statement confirming 15 Oct as the signing date | **UNSUPPORTED** | CRM contains the date, but no admissible customer evidence supports it |

**Invariants of the demo**
* The four claims do **not** mathematically determine `Forecast = Commit`. The application **does not downgrade** the deal. The manager owns the forecast.
* Logging *"Keep Forecast = Commit"* leaves Procurement **CONTRADICTED**.
* Extraction confidence (champion 0.99, procurement email 0.96, CFO email 0.97) is shown **separately** from status and never combined with it.

## 10. Invariants (checked by tests and the Consistency Matrix)

| ID | Invariant | Where enforced |
|---|---|---|
| **I-1** | Read-only: no code path writes to an external CRM or contacts a customer | Repository interface has no such method; UI states it |
| **I-2** | Status is computed only by `computeClaimStatus` from `(rule, claim, evidence, now)` | `statusEngine.ts`; unit tests |
| **I-3** | A `HumanDecision` never changes a `ComputedStatus` | Type signature + test "human decision does not alter status" |
| **I-4** | `extractionConfidence` is never an input to status. (In production a tuned threshold may stop a low-confidence *candidate* being stored as evidence at ingestion, an AI-layer precision control; policy never reads the score. D-09) | Type signature + test (confidence 0.01 vs 0.99 → same status) |
| **I-5** | Every evidence quote is a verbatim substring of its source text, with a source link | `demoData` integrity test |
| **I-6** | Rep sees flags before the manager | Deal `flagsSurfacedToRepAt` precedes the review; rep route; manager view shows the rep's response |
| **I-7** | Seller-supplied evidence is shown and labelled, but is never admissible | `isAdmissible` + test |
| **I-8** | The forecast category is only ever changed by a person, and only in the CRM | UI copy + no write method |
| **I-9** | Statuses say "in connected sources"; channels read are shown per deal | UI |
| **I-10** | Policy values are labelled illustrative hypotheses | RevOps screen |
