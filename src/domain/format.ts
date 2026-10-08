import type {
  ClaimDefinition,
  ClaimValue,
  ComputedStatus,
  DecisionType,
  EvidenceSourceType,
  ForecastCategory,
  SpeakerRole,
} from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** UTC-based so server and client render identically. "17 Sep". */
export function formatDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "2 Oct, 10:14 UTC". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${hh}:${mm} UTC`;
}

export function formatUsd(value: number): string {
  return value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`;
}

export function formatClaimValue(def: Pick<ClaimDefinition, "valueKind">, value: ClaimValue): string {
  if (value === null || value === undefined) return "Not set";
  switch (def.valueKind) {
    case "BOOLEAN":
      return value ? "Yes" : "No";
    case "DURATION_WEEKS":
      return `${value} ${value === 1 ? "week" : "weeks"}`;
    case "DATE":
      return formatDate(String(value));
  }
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/**
 * The claim as a sentence, using the CRM value: "Procurement takes two weeks", "Close by 15 Oct".
 * (The claim is what the CRM asserts; the evidence is judged against it.)
 */
export function claimStatement(def: ClaimDefinition, crmValue: ClaimValue): string {
  switch (def.id) {
    case "BUDGET_CONFIRMED":
      return "Budget confirmed";
    case "SECURITY_COMPLETE":
      return "Security review complete";
    case "PROCUREMENT_DURATION": {
      if (typeof crmValue !== "number") return "Procurement duration";
      const w = NUMBER_WORDS[crmValue] ?? String(crmValue);
      return `Procurement takes ${w} ${crmValue === 1 ? "week" : "weeks"}`;
    }
    case "CLOSE_DATE":
      return crmValue ? `Close by ${formatDate(String(crmValue))}` : "Close date";
    case "ECONOMIC_BUYER_ENGAGED":
      return "Economic buyer engaged";
    case "LEGAL_REVIEW_STARTED":
      return "Contract in customer legal review";
  }
}

export const FORECAST_LABEL: Record<ForecastCategory, string> = {
  COMMIT: "Commit",
  BEST_CASE: "Best Case",
  PIPELINE: "Pipeline",
};

export const ROLE_LABEL: Record<SpeakerRole, string> = {
  CFO: "CFO",
  ECONOMIC_BUYER: "Economic buyer",
  CUSTOMER_SECURITY: "Customer security",
  PROCUREMENT: "Procurement",
  LEGAL: "Legal",
  SIGNER: "Signer",
  CHAMPION: "Champion",
  CUSTOMER_OTHER: "Customer (other)",
  SELLER_REP: "Seller (rep)",
};

export const SOURCE_TYPE_LABEL: Record<EvidenceSourceType, string> = {
  CUSTOMER_EMAIL: "Customer email",
  CALL_TRANSCRIPT: "Call recording",
  CRM_NOTE: "Rep note in CRM",
  SELLER_ATTACHMENT: "Seller-attached",
};

export const STATUS_LABEL: Record<ComputedStatus, string> = {
  SUPPORTED: "Supported",
  UNSUPPORTED: "Unsupported",
  CONTRADICTED: "Contradicted",
  STALE: "Stale",
  UNKNOWN: "Unknown",
};

/** One-line definitions, identical to PRODUCT_CONTRACT §4 and deck slide 12. */
export const STATUS_DEFINITION: Record<ComputedStatus, string> = {
  SUPPORTED: "Admissible customer evidence exists; nothing later disagrees.",
  UNSUPPORTED: "The CRM asserts it; no customer evidence in connected sources.",
  CONTRADICTED: "Later or more authoritative evidence disagrees.",
  STALE: "The evidence is older than the claim's freshness window.",
  UNKNOWN: "Nobody has claimed it and no evidence exists.",
};

export const DECISION_LABEL: Record<DecisionType, string> = {
  KEEP_FORECAST: "Keep forecast",
  PLAN_FORECAST_CHANGE: "Plan a forecast change",
  ASK_REP_TO_VERIFY: "Ask rep to verify",
  DISPUTE_INTERPRETATION: "Disputes the reading",
  VERIFY_WITH_CUSTOMER: "Will verify with customer",
  CRM_CORRECTION_PLANNED: "Will correct the CRM",
};
