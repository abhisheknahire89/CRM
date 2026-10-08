# Engineering Approach: Deal Evidence Ledger

**Evidence-native CRM · first product · MVP, architecture, team and implementation · evaluator edition**
*Abhishek Nahire · Product Manager, AI Solutions*

> Six pages for a quick read. The detailed appendix is `ENGINEERING_APPROACH.md` (same system, same entities, more depth). Figures marked **[proposed]** are for agreement with engineering and a design partner; nothing is validated with customers yet.

---

## 1. MVP and engineering principles

**Goal.** Before a forecast call, identify the important deal claims that are **unsupported, contradicted or stale**, with the **exact evidence** for each. Today a CRM stores `FIELD = VALUE`; this product stores `CLAIM + EVIDENCE + SOURCE + TIME + HISTORY + STATUS`, and fields become views of it.

**The principle: AI interprets. Policy computes. People decide.** Policy computes five statuses: **SUPPORTED · UNSUPPORTED · CONTRADICTED · STALE · UNKNOWN**. A human decision is stored beside the status and never rewrites it.

**Users.** Front-line **sales manager** (primary) · **account executive** (secondary) · **CRO / VP Sales** (economic buyer) · **RevOps** (operational champion). Workflow: the **weekly forecast review**.

**V1 is read-only with respect to the external CRM.**

| IN | NOT YET (future possibilities only) |
|---|---|
| Salesforce *or* HubSpot · email + calendar · **one** call recorder | CRM replacement · generic AI chat or agent |
| **Commit** and **Best Case** deals · **5–8 predefined claims** | Win/loss prediction · autonomous forecasting |
| Exact quote, speaker, role, time, source link, status, reason, history | Autonomous emails · AI SDR · any customer contact |
| **Rep sees flags before the manager** | WhatsApp / chat · buyer portal · relationship graph · renewals |
| Human decision log, stored separately | Custom rules builder · autonomous CRM write-back |

**Must prove** (proposed thresholds, **not industry benchmarks**): **≥ 90 %** of evidence citations correct and relevant · **> 50 %** of flags judged worth raising by managers · guardrail: reps do not reject it or record less.

**Engineering principles.** (1) **Read-only before write-back.** (2) **Evidence must always be inspectable.** (3) **AI proposes interpretation; deterministic policy computes status.** (4) **Human decisions remain separate from evidence status.** (5) **Precision before recall.** (6) **Every automated judgment must be auditable.** (7) **Tenant isolation and least-privilege access from day one.**

---

## 2. System architecture

![System architecture](assets/architecture.svg)

**Simplest architecture that carries a pilot:** a modular monolith (API, connector, extraction and policy workers), **one Postgres**, one object store, one job queue, and a hosted LLM behind a thin gateway. **Not built:** vector DB, graph DB, Kafka, microservices, agent framework; none is needed for V1, and each has a stated trigger in the appendix. The prototype's `EvidenceRepository` is the Application API contract, and its status engine is the code the policy worker would run.

---

## 3. The AI / policy / human boundary, using Castellan

| AI interprets (probabilistic) | Policy computes (deterministic) | People decide |
|---|---|---|
| Finds passages · exact quote · speaker · **proposed** role · maps to a predefined claim · structures dates and durations · flags candidate conflicts · **extraction confidence** | Admissibility · authority rank · freshness · precedence · **status** · evidence review priority · next question | Forecast call · customer contact · missing evidence · disputing a reading · changing the CRM |
| **Never:** decides status, predicts win/loss, contacts customers | **Never:** reads a model score or a human decision | **Never:** rewrites a computed status |

**Castellan Freight, *Procurement takes two weeks* (CRM says 2 weeks).** The champion said "about two weeks" on a 22 Sep call. Procurement wrote four weeks on 2 Oct. **① AI output** for the email (the prototype's exact wire format; the champion passage is the same shape, `0.99`, `CHAMPION`, value `2`):

```json
{
  "extraction_id": "ex-cf-proc-email",
  "deal_id": "castellan-freight",
  "claim_definition": "PROCUREMENT_DURATION",
  "source_id": "src-ex-cf-proc-email",
  "source_type": "CUSTOMER_EMAIL",
  "quote": "Our standard procurement review is four weeks after receipt of the complete document set.",
  "speaker": "Hannah Brandt",
  "speaker_role_candidate": "PROCUREMENT",
  "timestamp": "2026-10-02T10:14:00Z",
  "structured_value": 4,
  "extraction_confidence": 0.96,
  "candidate_conflicts": ["ex-cf-proc-champion"],
  "model_version": "extractor-demo-0.1",
  "prompt_version": "claims-v0.1"
}
```

**② Deterministic rule:** accepted authority **Procurement › Legal**; fresh for **30 days**; **later or more authoritative evidence wins**. The champion is not an accepted authority, so that passage is context. **③ Policy output** (real prototype output):

```json
{
  "status": "CONTRADICTED",
  "reasonCode": "CONTRADICTED_LATER_OR_HIGHER_AUTHORITY",
  "reason": "Later, more authoritative procurement evidence disagrees: Hannah Brandt (Procurement) states 4 weeks on 2 Oct; the CRM says 2 weeks. Earlier: Marcus Lindqvist (Champion) said 2 weeks on 22 Sep.",
  "controllingEvidenceId": "ex-cf-proc-email",
  "supersededEvidenceIds": ["ex-cf-proc-champion"]
}
```

**④ People decide:** the manager logs *Keep Forecast = Commit* with a reason. The status stays **CONTRADICTED**.

> **LLM confidence does not determine status.** The model was 99 % sure the champion said it. That describes *extraction*. The claim is CONTRADICTED because policy found later, more authoritative evidence. A test changes the confidence to 0.01 or 0.99 and the status does not move.

---

## 4. AI quality, evaluation and failure handling

**Offline evaluation.** **50 closed deals × about 8 claims ≈ 400 claim evaluations**, labelled by hand by two labellers with adjudication, **point-in-time** (judged as at that week's forecast review, not at close). Dev/test split with a locked test set. Hard cases oversampled: hedged language, conditionals, forwarded threads, multi-speaker calls.

| Level | Metrics, reported separately |
|---|---|
| **Extraction** | Quote/span precision · speaker accuracy · claim-mapping accuracy · **role accuracy** |
| **Product output** | Evidence citation judged relevant and correct · status agreement with a human evaluation under the same policy · flags managers judge worth raising |

**Threshold [proposed product threshold, not an industry benchmark]: ≥ 90 % citation correctness and relevance.** At ~400 evaluations that is about ±3 points overall (±8 within one claim type), so we judge the threshold overall and treat per-claim numbers as directional. **Tune for precision before recall.** If the bar is missed, narrow the claim set first.

| Failure | Safeguard |
|---|---|
| Wrong speaker or role | Role shown as *proposed by AI* on every card; one-step dispute; role accuracy tracked |
| Hedged remark read as a commitment | Verbatim quote always shown and linked; only accepted-authority customer evidence counts |
| Channel the system cannot see | "In connected sources" wording; channels shown per deal; rep can add **seller-supplied context** |
| Quote out of context | Source viewer shows the surrounding passage; conditionals are in the gold set |
| Prompt or model change shifts results | Hand-marked set **re-runs on every model, prompt or policy change**; a drop blocks release |
| Prompt injection in a source | Source text is untrusted data; extractor has no tools; schema and verbatim-quote checks |

**Bounded blast radius:** a mistake changes **no CRM record** and reaches **no customer**; the rep can dispute it before the manager sees it.

---

## 5. Security, privacy and enterprise readiness

| Area | Approach |
|---|---|
| **Access** | OAuth per source; **minimum scopes, read-only for the CRM**; tokens in a secrets manager with per-tenant envelope encryption; customer admin can revoke at any time |
| **Tenant isolation** | `tenant_id` on every row with Postgres row-level security; per-tenant keys; cross-tenant tests in CI |
| **RBAC** | Manager sees their reporting line, rep sees their own deals, RevOps sees policy and aggregates, not individual rep performance |
| **Source-level permissions** | **A manager is never shown evidence they could not open under company policy.** Access metadata is ingested with each source and checked on every evidence read; **default-deny** when access cannot be established |
| **Consent and recording policy** | Only what the company's recorder already records under its own consent settings; we never start recording; private or excluded calls are not ingested |
| **Encryption, retention, deletion** | TLS in transit, encryption at rest; we store the quote, a short context window and a pointer, and fetch full text from the source with the viewer's own permission; configurable retention; deletion cascades by source and tenant |
| **Audit** | Append-only log of every automated judgment (model, prompt, policy version), evidence view, human decision and policy change |
| **LLM handling** | Zero-retention, no-training terms; provider gateway; region pinning if required |
| **Platform dependency** | Email, call and CRM APIs can change, be rate-limited or be closed to third parties. Each source sits behind an adapter with contract tests; "sync degraded" is shown, never silently stale; V1 depends on **one CRM and one recorder** by choice |

---

## 6. Team, implementation plan, stage gates and top risks

**Team (lean): 1 Product Manager** (claim set, evaluation design, gates) · **1 Product Designer** (review experience, rep-first flow) · **2 Full-stack / Backend Engineers** (connectors, evidence store, policy worker, API, UI) · **1 Applied AI / ML Engineer** (extraction, evaluation harness, regression runs). Shared part-time: security / DevOps, QA / data labelling.

| Weeks | Build | Gate |
|---|---|---|
| **0** | Design partner and **historical audit**; freeze 5–8 claims; first labelled set | **G0 value:** lost and slipped deals carry more unsupported or contradicted claims than won ones, else **stop** |
| **1–2** | Domain model, CRM connector, email and call ingestion, source viewer, tenant and auth | Real partner data visible in the source viewer |
| **3–4** | Extraction pipeline, speaker and claim mapping, evaluation harness | **G1 (interim):** dev-set precision at an agreed bar [proposed ≈ 85 %] or narrow claims |
| **5–6** | Policy engine, queue, deal ledger, rep dispute, decision log | End-to-end on partner data |
| **7** | RevOps policy settings, security hardening, audit logs, performance | Pen-test findings addressed |
| **8** | Historical backtest and accuracy evaluation | **G2 accuracy:** **≥ 90 %** citations correct and relevant, else narrow and tune |
| **9–10** | Design-partner live pilot, rep-first | **G3 adoption:** **> 50 %** flags worth raising, disputes low, recording not falling |

**The historical audit:** *This tests whether evidence quality separates outcomes enough to justify a live pilot. It does not establish causality.* **Do not start write-back until** citation quality has cleared the threshold **and** an adoption signal exists.

### TOP PRODUCT/TECHNICAL RISKS

| Risk | Mitigation | What we measure |
|---|---|---|
| **1. Authority / role identification** | Start with claims where authority is relatively explicit, expose the inferred role, allow one-step correction, measure role accuracy separately, and narrow the claim set if reliability is inadequate. | Role accuracy; disputes citing speaker or role |
| **2. Missing communication channels** | Say "in connected sources"; list channels per deal; rep can add seller-supplied context | Disputes citing an unseen channel |
| **3. False extraction / interpretation** | Exact quote with context and link; precision-first tuning; regression set on every change | Citation precision, incl. hedged and conditional cases |
| **4. Rep surveillance / adoption** | Rep sees flags first; managers see deal evidence, not activity counts; audit reported by pattern, not by rep | Disputes; **recording rate** (is it falling?) |
| **5. Platform / API dependency** | One CRM and one recorder; adapters; contract tests; "sync degraded" status | Sync lag; breaking changes per quarter |
| **6. Evidence quality may not separate deal outcomes** | This is the **first test**, before any live build, judged point-in-time; if it does not separate outcomes, we stop | Unsupported/contradicted rate on won vs lost vs slipped deals |

Not every risk is solved; the plan is built so the cheapest tests come first.
