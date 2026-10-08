import type { ClaimDefinition, ClaimDefinitionId, PolicyRule } from "./types";

/**
 * RevOps policy: a simple, PREDEFINED set. Not a rules engine (a custom rules builder is "not yet").
 * Every value below is an illustrative hypothesis to agree with a design partner
 * (deck slide 12 / backup B4; PRODUCT_CONTRACT §5).
 */

export const CLAIM_DEFINITIONS: ClaimDefinition[] = [
  {
    id: "BUDGET_CONFIRMED",
    shortLabel: "Budget",
    label: "Budget confirmed",
    valueKind: "BOOLEAN",
    matchMode: "EQUALS",
    nextQuestion: "Can the budget holder confirm in writing that the funds are approved for this rollout?",
  },
  {
    id: "SECURITY_COMPLETE",
    shortLabel: "Security",
    label: "Security complete",
    valueKind: "BOOLEAN",
    matchMode: "EQUALS",
    nextQuestion: "Has the customer's security team confirmed the review is complete, in writing?",
  },
  {
    id: "PROCUREMENT_DURATION",
    shortLabel: "Procurement",
    label: "Procurement duration",
    valueKind: "DURATION_WEEKS",
    matchMode: "AT_MOST",
    nextQuestion: "What is procurement's standard review time, and does it start on receipt of the full document set?",
  },
  {
    id: "CLOSE_DATE",
    shortLabel: "Close date",
    label: "Close date",
    valueKind: "DATE",
    matchMode: "AT_MOST",
    nextQuestion: "Has the signer or economic buyer named a target signing date?",
  },
  {
    id: "ECONOMIC_BUYER_ENGAGED",
    shortLabel: "Economic buyer",
    label: "Economic buyer engaged",
    valueKind: "BOOLEAN",
    matchMode: "EQUALS",
    nextQuestion: "Has the economic buyer taken part in a call or email thread on this deal?",
  },
  {
    id: "LEGAL_REVIEW_STARTED",
    shortLabel: "Legal review",
    label: "Legal review started",
    valueKind: "BOOLEAN",
    matchMode: "EQUALS",
    nextQuestion: "Has the customer's legal team confirmed they have the contract and started review?",
  },
];

const CUSTOMER_SIDE_SOURCES = ["CUSTOMER_EMAIL", "CALL_TRANSCRIPT"] as const;

/** Illustrative starter policy. Order of `acceptedAuthorities` is precedence (earlier = higher). */
export const DEFAULT_POLICY_RULES: PolicyRule[] = [
  { definitionId: "BUDGET_CONFIRMED", acceptedAuthorities: ["CFO", "ECONOMIC_BUYER"], freshnessDays: 60 },
  { definitionId: "SECURITY_COMPLETE", acceptedAuthorities: ["CUSTOMER_SECURITY"], freshnessDays: 90 },
  { definitionId: "PROCUREMENT_DURATION", acceptedAuthorities: ["PROCUREMENT", "LEGAL"], freshnessDays: 30 },
  { definitionId: "CLOSE_DATE", acceptedAuthorities: ["SIGNER", "ECONOMIC_BUYER"], freshnessDays: 30 },
  { definitionId: "ECONOMIC_BUYER_ENGAGED", acceptedAuthorities: ["ECONOMIC_BUYER", "CFO"], freshnessDays: 45 },
  { definitionId: "LEGAL_REVIEW_STARTED", acceptedAuthorities: ["LEGAL"], freshnessDays: 30 },
].map((r) => ({
  ...r,
  admissibleSourceTypes: [...CUSTOMER_SIDE_SOURCES],
  version: "policy-v0.1-illustrative",
  illustrative: true as const,
})) as PolicyRule[];

/** Shown on the RevOps screen: admissible evidence, in words (deck slide 12, column 2). */
export const ADMISSIBLE_EVIDENCE_TEXT: Record<ClaimDefinitionId, string> = {
  BUDGET_CONFIRMED: "Customer email, call or document",
  SECURITY_COMPLETE: "Written confirmation or completed review from the customer",
  PROCUREMENT_DURATION: "Statement from procurement or legal",
  CLOSE_DATE: "Customer statement of a target signing date",
  ECONOMIC_BUYER_ENGAGED: "Customer email or call involving the economic buyer",
  LEGAL_REVIEW_STARTED: "Customer legal confirmation in email or call",
};

export function getDefinition(id: ClaimDefinitionId): ClaimDefinition {
  const d = CLAIM_DEFINITIONS.find((c) => c.id === id);
  if (!d) throw new Error(`Unknown claim definition ${id}`);
  return d;
}

export function getRule(rules: PolicyRule[], id: ClaimDefinitionId): PolicyRule {
  const r = rules.find((x) => x.definitionId === id);
  if (!r) throw new Error(`No policy rule for ${id}`);
  return r;
}
