# Deal Evidence Ledger · Evidence-native CRM

A clickable prototype and engineering approach for the *Reimagine CRM for the Future of Sales* assessment (Product Manager, AI Solutions).

> **AI interprets. Policy computes. People decide.**

Before a forecast call, the ledger shows which important deal claims are **unsupported, contradicted or stale**, with the exact quote, speaker, source and a link back to it. V1 is **read-only** with respect to the external CRM. The forecast stays the manager's judgment.

**Everything here describes one product.** The authoritative strategy is the deck in `input/`. The single source of truth for everything else is [`docs/PRODUCT_CONTRACT.md`](docs/PRODUCT_CONTRACT.md); `src/domain/` implements it; tests check the docs against the code.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000   (the prototype)
npm test             # 66 tests: engine, invariants, UI regression, docs ↔ code consistency
npm run build        # static export to ./out, hostable on any static host
npm run docs:build   # regenerate the diagram and engineering-approach.html from the markdown
```

Demo route (the 2–3 minute flow, [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)): `/` → *Castellan Freight* → *Procurement* → *Log decision* → **Rep** in the top bar.

| Route | Screen |
|---|---|
| `/` | 1 · Forecast evidence queue (manager) |
| `/deals/castellan-freight/` | 2 · Castellan deal evidence: four claim cards |
| `/deals/castellan-freight/claims/PROCUREMENT_DURATION/` | 3 · Evidence detail, and 4 · human decision |
| `/rep/` · `/rep/deals/castellan-freight/` | 5 · Rep-first view (the rep sees flags before the manager) |
| `/revops/` | 6 · RevOps policy (illustrative hypotheses; freshness editable) |

**Reset demo** (top bar) clears everything you logged. Decisions persist in `localStorage` between reloads.

## Deliverables

| | |
|---|---|
| Product contract (single source of truth) | [`docs/PRODUCT_CONTRACT.md`](docs/PRODUCT_CONTRACT.md) |
| Decisions on ambiguities | [`docs/DECISIONS.md`](docs/DECISIONS.md) |
| **Engineering Approach** | [`docs/ENGINEERING_APPROACH.md`](docs/ENGINEERING_APPROACH.md) · standalone: [`engineering-approach.html`](engineering-approach.html) · print-ready PDF: [`engineering-approach.pdf`](engineering-approach.pdf) |
| Consistency matrix (PPT ↔ prototype ↔ engineering) | [`docs/CONSISTENCY_MATRIX.md`](docs/CONSISTENCY_MATRIX.md) |
| Demo script | [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) |

## How the code is organised

```
src/domain/            the product, with no UI and no framework
  types.ts             Deal, ClaimDefinition, Claim, Evidence, EvidenceSource, PolicyRule,
                       ComputedStatus, HumanDecision, User, UserRole
  aiContract.ts        AiExtraction: the wire format of "AI interprets"
  policies.ts          the illustrative RevOps rules (6 claims, authorities, freshness)
  statusEngine.ts      "Policy computes": deterministic, takes no decision and no confidence
  priority.ts          queue inclusion and review priority
src/data/demoData.ts   synthetic data, written as AI extractions; no precomputed statuses
src/services/
  evidenceRepository.ts       the interface the UI depends on (the Engineering Approach's API contract)
  localEvidenceRepository.ts  in-memory implementation used by the prototype
src/components/        the six screens
tests/                 unit, invariant, UI regression, and docs ↔ code consistency tests
```

The UI never contains product logic. It asks a repository for data that the status engine has already computed.

## Deliberate prototype shortcuts

| Shortcut | Replaced in production by |
|---|---|
| No backend: `LocalEvidenceRepository`, state in `localStorage` | An API client implementing the same `EvidenceRepository` interface |
| Synthetic emails, calls and AI extractions | Connectors → normalisation → extraction pipeline, emitting the same `AiExtraction` shape |
| Statuses computed on read | Computed on change and persisted, with the same `computeClaimStatus` |
| Fixed clock: 8 Oct 2026, 09:00 UTC | Real time (`now` is an injected parameter) |
| Role toggle instead of sign-in | SSO + RBAC |
| Source "deep links" are simulated (`*.example`) | Real deep links; source text fetched with the viewer's permission |
| Decision reason prefilled on the Procurement claim | Left empty |

## Honest limits

No customer interviews yet. Castellan Freight, every account, person and quote is invented. Policy values and thresholds are proposals, not benchmarks. See [`docs/DECISIONS.md`](docs/DECISIONS.md) for every judgment call.
