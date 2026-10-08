import { toRawEvidence, type AiExtraction } from "@/domain/aiContract";
import { evidenceDisposition } from "@/domain/evidenceView";
import { claimStatement } from "@/domain/format";
import { CLAIM_DEFINITIONS, DEFAULT_POLICY_RULES, getDefinition, getRule } from "@/domain/policies";
import { compareQueue, countStatuses, needsReview, reviewPriority } from "@/domain/priority";
import { computeClaimStatus, stampEvidence } from "@/domain/statusEngine";
import type {
  Claim,
  ClaimDefinitionId,
  Evidence,
  EvidenceSource,
  HumanDecision,
  PolicyRule,
  User,
} from "@/domain/types";
import { claimIdFor } from "@/domain/aiContract";
import {
  DEMO_NOW,
  demoClaimSeeds,
  demoDecisions,
  demoDeals,
  demoExtractions,
  demoSources,
  demoUsers,
} from "@/data/demoData";
import type {
  ClaimEntry,
  DealLedger,
  EvidenceRepository,
  EvidenceView,
  NewDecision,
  NewSellerEvidence,
  PolicySnapshot,
  QueueItem,
  ReviewQueue,
} from "./evidenceRepository";

const STORAGE_KEY = "evidence-ledger-prototype-v1";

interface MutableState {
  decisions: HumanDecision[];
  attachedSources: EvidenceSource[];
  attachedExtractions: AiExtraction[];
  freshnessOverrides: Partial<Record<ClaimDefinitionId, number>>;
}

const freshState = (): MutableState => ({
  decisions: structuredClone(demoDecisions),
  attachedSources: [],
  attachedExtractions: [],
  freshnessOverrides: {},
});

export interface LocalRepositoryOptions {
  /** Evaluation time for statuses. Fixed so the demo is reproducible. */
  asOf?: string;
  /** Clock for new decisions / attachments. */
  clock?: () => string;
  /** Persist mutable state to localStorage (browser only). */
  persist?: boolean;
}

/**
 * In-memory implementation of EvidenceRepository for the prototype.
 *
 * Everything user-visible is computed here by the SAME domain functions the production
 * policy service would run (`stampEvidence`, `computeClaimStatus`). Only storage is faked.
 */
export class LocalEvidenceRepository implements EvidenceRepository {
  private state: MutableState = freshState();
  private listeners = new Set<() => void>();
  private readonly asOf: string;
  private readonly clock: () => string;
  private readonly persist: boolean;

  constructor(opts: LocalRepositoryOptions = {}) {
    this.asOf = opts.asOf ?? DEMO_NOW;
    const started = Date.now();
    this.clock = opts.clock ?? (() => new Date(Date.parse(DEMO_NOW) + (Date.now() - started)).toISOString());
    this.persist = opts.persist ?? false;
  }

  // ── plumbing ──

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    if (this.persist) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch {
        /* storage unavailable: the prototype still works in memory */
      }
    }
    this.listeners.forEach((l) => l());
  }

  hydrate() {
    if (!this.persist) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.state = { ...freshState(), ...JSON.parse(raw) };
        this.listeners.forEach((l) => l());
      }
    } catch {
      /* ignore corrupt storage */
    }
  }

  resetDemo() {
    this.state = freshState();
    this.emit();
  }

  // ── policy ──

  private rules(): PolicyRule[] {
    return DEFAULT_POLICY_RULES.map((r) => ({
      ...r,
      freshnessDays: this.state.freshnessOverrides[r.definitionId] ?? r.freshnessDays,
    }));
  }

  async getPolicy(): Promise<PolicySnapshot> {
    return {
      definitions: CLAIM_DEFINITIONS,
      rules: this.rules(),
      modified: Object.keys(this.state.freshnessOverrides).length > 0,
    };
  }

  async setFreshnessDays(definitionId: ClaimDefinitionId, days: number) {
    const safe = Math.max(1, Math.min(365, Math.round(days)));
    const base = getRule(DEFAULT_POLICY_RULES, definitionId).freshnessDays;
    const next = { ...this.state.freshnessOverrides };
    if (safe === base) delete next[definitionId];
    else next[definitionId] = safe;
    this.state = { ...this.state, freshnessOverrides: next };
    this.emit();
  }

  async restorePolicyDefaults() {
    this.state = { ...this.state, freshnessOverrides: {} };
    this.emit();
  }

  // ── reads ──

  async getUsers() {
    return demoUsers;
  }

  private sources(): EvidenceSource[] {
    return [...demoSources, ...this.state.attachedSources];
  }

  private extractions(): AiExtraction[] {
    return [...demoExtractions, ...this.state.attachedExtractions];
  }

  private buildEntries(dealId: string): ClaimEntry[] {
    const rules = this.rules();
    return demoClaimSeeds
      .filter((s) => s.dealId === dealId)
      .map((seed) => {
        const definition = getDefinition(seed.definitionId);
        const rule = getRule(rules, seed.definitionId);
        const raw = this.extractions()
          .filter((x) => claimIdFor(x.deal_id, x.claim_definition) === seed.id)
          .map(toRawEvidence);
        const evidence = stampEvidence(rule, raw);
        const explanation = computeClaimStatus({ definition, rule, crmValue: seed.crmValue, evidence, now: this.asOf });
        const claim: Claim = {
          ...seed,
          computedStatus: explanation.status,
          lastComputedAt: this.asOf,
          explanation,
        };
        const views: EvidenceView[] = evidence.map((e) => ({ ...e, disposition: evidenceDisposition(explanation, e) }));
        const customerSide = views.filter((e) => e.authority !== "SELLER_SUPPLIED");
        return {
          claim,
          definition,
          rule,
          statement: claimStatement(definition, seed.crmValue),
          evidence: views,
          latestEvidence: customerSide.length ? customerSide[customerSide.length - 1] : views[views.length - 1] ?? null,
          decisions: [],
        } satisfies ClaimEntry;
      });
  }

  private decisionsFor(dealId: string): HumanDecision[] {
    return this.state.decisions
      .filter((d) => d.dealId === dealId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  private userMap(): Record<string, User> {
    return Object.fromEntries(demoUsers.map((u) => [u.id, u]));
  }

  async getDealLedger(dealId: string): Promise<DealLedger | null> {
    const deal = demoDeals.find((d) => d.id === dealId);
    if (!deal) return null;
    const users = this.userMap();
    const allDecisions = this.decisionsFor(dealId);
    const claims = this.buildEntries(dealId).map((e) => ({
      ...e,
      decisions: allDecisions.filter((d) => d.claimId === e.claim.id),
    }));
    const counts = countStatuses(claims.map((c) => c.claim));
    const sources = Object.fromEntries(this.sources().filter((s) => s.dealId === dealId).map((s) => [s.id, s]));
    return {
      deal,
      owner: users[deal.ownerRepId],
      manager: users[deal.managerId],
      claims,
      counts,
      priority: reviewPriority(deal.forecastCategory, counts),
      inQueue: needsReview(deal.forecastCategory, counts),
      dealDecisions: allDecisions.filter((d) => !d.claimId),
      allDecisions,
      sources,
      users,
    };
  }

  async getReviewQueue(opts: { repId?: string } = {}): Promise<ReviewQueue> {
    const users = this.userMap();
    const items: QueueItem[] = [];
    let hidden = 0;
    for (const deal of demoDeals) {
      if (opts.repId && deal.ownerRepId !== opts.repId) continue;
      const entries = this.buildEntries(deal.id);
      const counts = countStatuses(entries.map((e) => e.claim));
      if (!needsReview(deal.forecastCategory, counts)) {
        if (deal.forecastCategory !== "PIPELINE") hidden++;
        continue;
      }
      const priority = reviewPriority(deal.forecastCategory, counts);
      const decisions = this.decisionsFor(deal.id);
      const flagged = new Set(
        entries.filter((e) => ["UNSUPPORTED", "CONTRADICTED"].includes(e.claim.computedStatus)).map((e) => e.claim.id),
      );
      const repResponses = new Set(
        decisions.filter((d) => d.claimId && flagged.has(d.claimId) && users[d.userId]?.role === "REP").map((d) => d.claimId),
      ).size;
      items.push({
        deal,
        owner: users[deal.ownerRepId],
        counts,
        priority,
        claims: entries.map((e) => ({ id: e.claim.id, definitionId: e.claim.definitionId, computedStatus: e.claim.computedStatus })),
        latestDecision: decisions.find((d) => users[d.userId]?.role === "MANAGER") ?? null,
        repResponses,
      });
    }
    items.sort(compareQueue);
    return { items, hiddenCount: hidden };
  }

  // ── writes (local, simulated; nothing leaves this object: I-1) ──

  async logDecision(input: NewDecision): Promise<HumanDecision> {
    const decision: HumanDecision = {
      id: `dec-${this.state.decisions.length + 1}-${Date.parse(this.clock())}`,
      dealId: input.dealId,
      claimId: input.claimId,
      decisionType: input.decisionType,
      value: input.value,
      reason: input.reason.trim(),
      userId: input.userId,
      createdAt: this.clock(),
    };
    // Appended to the decision log. Deliberately does not touch any claim: I-3.
    this.state = { ...this.state, decisions: [...this.state.decisions, decision] };
    this.emit();
    return decision;
  }

  async attachSellerEvidence(input: NewSellerEvidence): Promise<Evidence> {
    const user = demoUsers.find((u) => u.id === input.userId);
    const seed = demoClaimSeeds.find((s) => s.dealId === input.dealId && s.definitionId === input.definitionId);
    if (!user || !seed) throw new Error("Unknown user or claim");
    const n = this.state.attachedSources.length + 1;
    const at = this.clock();
    const sourceId = `src-attached-${n}`;
    const source: EvidenceSource = {
      id: sourceId,
      dealId: input.dealId,
      type: "SELLER_ATTACHMENT",
      title: `Context added by ${user.name}`,
      occurredAt: at,
      participants: [{ name: user.name, role: "SELLER_REP" }],
      text: input.note.trim(),
      deepLink: `https://ledger.example/attachments/${sourceId}`,
    };
    const extraction: AiExtraction = {
      extraction_id: `ex-attached-${n}`,
      deal_id: input.dealId,
      claim_definition: input.definitionId,
      source_id: sourceId,
      source_type: "SELLER_ATTACHMENT",
      quote: source.text,
      speaker: user.name,
      speaker_role_candidate: "SELLER_REP",
      timestamp: at,
      structured_value: seed.crmValue,
      extraction_confidence: 1,
      candidate_conflicts: [],
      model_version: "attached-by-rep",
      prompt_version: "n/a",
    };
    this.state = {
      ...this.state,
      attachedSources: [...this.state.attachedSources, source],
      attachedExtractions: [...this.state.attachedExtractions, extraction],
    };
    this.emit();
    const entry = this.buildEntries(input.dealId).find((e) => e.claim.definitionId === input.definitionId)!;
    return entry.evidence.find((e) => e.id === extraction.extraction_id)!;
  }
}
