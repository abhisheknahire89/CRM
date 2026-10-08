/**
 * Domain types. Implements docs/PRODUCT_CONTRACT.md §6.
 *
 * Boundary reminder (AI interprets · Policy computes · People decide):
 *  - `AiExtraction` is what the probabilistic layer produces (see aiContract.ts).
 *  - `ComputedStatus` / `StatusExplanation` are what the deterministic policy produces.
 *  - `HumanDecision` is what people log. It is stored separately and is never an input to status.
 */

// ── Users ────────────────────────────────────────────────────────────────────

/** Prototype roles. The CRO / VP Sales is the economic buyer, not a prototype role. */
export type UserRole = "MANAGER" | "REP" | "REVOPS";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  title: string;
}

// ── Deals ────────────────────────────────────────────────────────────────────

export type ForecastCategory = "COMMIT" | "BEST_CASE" | "PIPELINE";

/** Channels the ledger can read for a deal. "No evidence" always means "in connected sources". */
export type ConnectedChannel = "CRM" | "EMAIL" | "CALENDAR" | "CALL_RECORDER";

export interface Deal {
  id: string;
  accountName: string;
  valueUsd: number;
  /** The EXTERNAL CRM's forecast category. The ledger only reads it. */
  forecastCategory: ForecastCategory;
  /** ISO date (YYYY-MM-DD) as held in the external CRM. */
  closeDate: string;
  ownerRepId: string;
  managerId: string;
  connectedChannels: ConnectedChannel[];
  /** Rep sees flags before the manager (invariant I-6). */
  flagsSurfacedToRepAt: string;
}

// ── Claims ───────────────────────────────────────────────────────────────────

export type ClaimDefinitionId =
  | "BUDGET_CONFIRMED"
  | "SECURITY_COMPLETE"
  | "PROCUREMENT_DURATION"
  | "CLOSE_DATE"
  | "ECONOMIC_BUYER_ENGAGED"
  | "LEGAL_REVIEW_STARTED";

export type ClaimValueKind = "BOOLEAN" | "DURATION_WEEKS" | "DATE";

/** EQUALS: evidence must equal the CRM value. AT_MOST: evidence must be <= the CRM value. */
export type MatchMode = "EQUALS" | "AT_MOST";

/** A value as held by the CRM or structured by the AI: boolean, weeks, or ISO date (YYYY-MM-DD). */
export type ClaimValue = boolean | number | string | null;

/** One of the predefined, deal-critical claims (5–8 in V1). Not user-definable in V1. */
export interface ClaimDefinition {
  id: ClaimDefinitionId;
  /** Short label used on cards: "Budget". */
  shortLabel: string;
  /** Full claim wording: "Budget confirmed". */
  label: string;
  valueKind: ClaimValueKind;
  matchMode: MatchMode;
  /** Policy output "next question to ask" (deck slide 4). Fixed template per definition. */
  nextQuestion: string;
}

export type ComputedStatus =
  | "SUPPORTED"
  | "UNSUPPORTED"
  | "CONTRADICTED"
  | "STALE"
  | "UNKNOWN";

export type StatusReasonCode =
  | "SUPPORTED_ACCEPTED_AUTHORITY"
  | "UNSUPPORTED_NO_ADMISSIBLE_EVIDENCE"
  | "CONTRADICTED_LATER_OR_HIGHER_AUTHORITY"
  | "CONTRADICTED_NO_SUPPORT"
  | "STALE_EVIDENCE_OUTSIDE_WINDOW"
  | "UNKNOWN_NO_CLAIM_NO_EVIDENCE";

/** The auditable record of *why* the policy computed a status. Never contains model confidence. */
export interface StatusExplanation {
  status: ComputedStatus;
  reasonCode: StatusReasonCode;
  /** Plain-language reason shown on cards and in the detail view. */
  reason: string;
  /** The same reason in one short line, for the top of the evidence detail. */
  headline: string;
  /** The admissible evidence the status turns on (if any). */
  controllingEvidenceId: string | null;
  supportingEvidenceIds: string[];
  disagreeingEvidenceIds: string[];
  /** Customer context evidence that agreed with the CRM but was outranked by the controlling evidence. */
  supersededEvidenceIds: string[];
  /** Customer-side evidence from a non-accepted authority: context only. */
  contextEvidenceIds: string[];
  /** Seller-supplied evidence: shown, never admissible (I-7). */
  sellerSuppliedEvidenceIds: string[];
  freshnessDays: number;
  /** Age in days of the most recent supporting evidence at `evaluatedAt`, if any. */
  evidenceAgeDays: number | null;
  ruleVersion: string;
  evaluatedAt: string;
}

export interface Claim {
  id: string;
  dealId: string;
  definitionId: ClaimDefinitionId;
  /** What the external CRM currently asserts. `null` = the CRM asserts nothing. */
  crmValue: ClaimValue;
  computedStatus: ComputedStatus;
  lastComputedAt: string;
  explanation: StatusExplanation;
}

/** What a claim looks like before the policy has evaluated it (seed / ingest shape). */
export type ClaimSeed = Pick<Claim, "id" | "dealId" | "definitionId" | "crmValue">;

// ── Evidence ─────────────────────────────────────────────────────────────────

export type EvidenceSourceType =
  | "CUSTOMER_EMAIL"
  | "CALL_TRANSCRIPT"
  | "CRM_NOTE" // seller-side
  | "SELLER_ATTACHMENT"; // seller-side: attached by a rep in the ledger

export type SpeakerRole =
  | "CFO"
  | "ECONOMIC_BUYER"
  | "CUSTOMER_SECURITY"
  | "PROCUREMENT"
  | "LEGAL"
  | "SIGNER"
  | "CHAMPION"
  | "CUSTOMER_OTHER"
  | "SELLER_REP";

export interface SourceParticipant {
  name: string;
  role: SpeakerRole;
}

/** A durable reference to the raw source. The quote must be a verbatim substring of `text` (I-5). */
export interface EvidenceSource {
  id: string;
  dealId: string;
  type: EvidenceSourceType;
  title: string;
  occurredAt: string;
  participants: SourceParticipant[];
  /** Surrounding context shown in the source viewer. */
  text: string;
  /** Deep link into the system of record. Simulated in the prototype. */
  deepLink: string;
}

/**
 * Policy-stamped, never AI-assigned:
 *  ACCEPTED         customer-side speaker whose role is an accepted authority for this claim
 *  CUSTOMER_CONTEXT customer-side speaker, not an accepted authority: context only
 *  SELLER_SUPPLIED  rep note / attachment: never customer evidence
 */
export type AuthorityLevel = "ACCEPTED" | "CUSTOMER_CONTEXT" | "SELLER_SUPPLIED";

export interface Evidence {
  id: string;
  claimId: string;
  sourceType: EvidenceSourceType;
  sourceId: string;
  speaker: string;
  /** AI-proposed role, unless a person corrected it. */
  speakerRole: SpeakerRole;
  speakerRoleBasis: "AI_PROPOSED" | "HUMAN_CORRECTED" | "SELLER_ATTACHED";
  timestamp: string;
  /** Exact quote, verbatim from the source. */
  quote: string;
  /** Value the AI structured from the quote (boolean, weeks, ISO date), or null. */
  structuredValue: ClaimValue;
  /** The model's confidence that it extracted this passage correctly. NOT a business status (I-4). */
  extractionConfidence: number;
  authority: AuthorityLevel;
  /** 1-based order of this evidence within its claim, by time. */
  sequence: number;
}

/** Evidence before the policy has stamped `authority` and `sequence`. */
export type RawEvidence = Omit<Evidence, "authority" | "sequence">;

// ── Policy ───────────────────────────────────────────────────────────────────

/** A simple, predefined RevOps rule. Not a rules engine (deck slide 7: "Custom rules engine" is not yet). */
export interface PolicyRule {
  definitionId: ClaimDefinitionId;
  /** Ordered: earlier = higher authority. */
  acceptedAuthorities: SpeakerRole[];
  admissibleSourceTypes: EvidenceSourceType[];
  freshnessDays: number;
  version: string;
  /** All values are illustrative hypotheses to agree with a design partner (I-10). */
  illustrative: true;
}

// ── Human decisions (stored separately from status) ──────────────────────────

export type DecisionType =
  // manager
  | "KEEP_FORECAST"
  | "PLAN_FORECAST_CHANGE"
  | "ASK_REP_TO_VERIFY"
  // rep
  | "DISPUTE_INTERPRETATION"
  | "VERIFY_WITH_CUSTOMER"
  | "CRM_CORRECTION_PLANNED";

export interface HumanDecision {
  id: string;
  dealId: string;
  claimId?: string;
  decisionType: DecisionType;
  /** e.g. "Commit". Free of any status. */
  value: string;
  reason: string;
  userId: string;
  createdAt: string;
}

// ── Derived views the UI renders ─────────────────────────────────────────────

export type ReviewPriority = "HIGH" | "MEDIUM" | "LOW";

export interface StatusCounts {
  SUPPORTED: number;
  UNSUPPORTED: number;
  CONTRADICTED: number;
  STALE: number;
  UNKNOWN: number;
}
