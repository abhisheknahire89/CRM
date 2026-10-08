import type {
  Claim,
  ClaimDefinition,
  ClaimDefinitionId,
  Deal,
  DecisionType,
  Evidence,
  EvidenceSource,
  HumanDecision,
  PolicyRule,
  ReviewPriority,
  StatusCounts,
  User,
} from "@/domain/types";
import type { EvidenceDisposition } from "@/domain/evidenceView";

/**
 * The contract between the UI and wherever evidence lives.
 *
 * The prototype implements it in memory (`localEvidenceRepository.ts`). The production
 * implementation is an HTTP client over the Application API described in the Engineering
 * Approach: same shapes, same methods. Note what the interface does NOT contain:
 * no method writes to an external CRM and none contacts a customer (invariant I-1),
 * and no method lets a decision or a model confidence set a status (I-3, I-4).
 *
 * All methods are async on purpose, so replacing the local repo with an API client
 * changes no UI code.
 */

export interface EvidenceView extends Evidence {
  disposition: EvidenceDisposition;
}

export interface ClaimEntry {
  claim: Claim;
  definition: ClaimDefinition;
  rule: PolicyRule;
  /** The claim as a sentence: "Procurement takes two weeks". */
  statement: string;
  /** All evidence, oldest first, with how each piece relates to the status. */
  evidence: EvidenceView[];
  /** The most recent customer-side evidence, shown on the card. */
  latestEvidence: EvidenceView | null;
  /** Decisions logged beside this claim (separate from status). */
  decisions: HumanDecision[];
}

export interface DealLedger {
  deal: Deal;
  owner: User;
  manager: User;
  claims: ClaimEntry[];
  counts: StatusCounts;
  priority: ReviewPriority;
  inQueue: boolean;
  /** Deal-level decisions (no claim attached), newest first. */
  dealDecisions: HumanDecision[];
  /** All decisions on the deal, newest first. */
  allDecisions: HumanDecision[];
  sources: Record<string, EvidenceSource>;
  users: Record<string, User>;
}

export interface QueueItem {
  deal: Deal;
  owner: User;
  counts: StatusCounts;
  priority: ReviewPriority;
  claims: Pick<Claim, "id" | "definitionId" | "computedStatus">[];
  /** Latest decision (any person) on the deal, for the "decided" marker. */
  latestDecision: HumanDecision | null;
  /** How many flagged claims the rep has already responded to. */
  repResponses: number;
}

export interface ReviewQueue {
  items: QueueItem[];
  /** Commit / Best Case deals with no unsupported or contradicted claim. Not shown. */
  hiddenCount: number;
}

export interface NewDecision {
  dealId: string;
  claimId?: string;
  decisionType: DecisionType;
  value: string;
  reason: string;
  userId: string;
}

export interface NewSellerEvidence {
  dealId: string;
  definitionId: ClaimDefinitionId;
  note: string;
  userId: string;
}

export interface PolicySnapshot {
  definitions: ClaimDefinition[];
  rules: PolicyRule[];
  /** True if any rule differs from the illustrative defaults. */
  modified: boolean;
}

export interface EvidenceRepository {
  getUsers(): Promise<User[]>;
  /** `repId` limits to a rep's own deals (the rep-first view). */
  getReviewQueue(opts?: { repId?: string }): Promise<ReviewQueue>;
  getDealLedger(dealId: string): Promise<DealLedger | null>;
  getPolicy(): Promise<PolicySnapshot>;
  /** RevOps tunes a freshness window. Statuses recompute deterministically. */
  setFreshnessDays(definitionId: ClaimDefinitionId, days: number): Promise<void>;
  /** Restores the illustrative policy defaults. Does not touch decisions. */
  restorePolicyDefaults(): Promise<void>;
  /** Stored beside the claim. Never changes a computed status. */
  logDecision(input: NewDecision): Promise<HumanDecision>;
  /** Rep-supplied evidence: shown and labelled, never admissible (I-7). */
  attachSellerEvidence(input: NewSellerEvidence): Promise<Evidence>;
  /** Subscribe to changes; returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Re-reads persisted local state (client only). */
  hydrate(): void;
  resetDemo(): void;
}
