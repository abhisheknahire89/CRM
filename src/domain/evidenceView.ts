import type { Evidence, StatusExplanation } from "./types";

/** How a piece of evidence relates to the computed status. Policy-derived, shown on every evidence card. */
export type EvidenceDisposition =
  | "SUPPORTS"
  | "DISAGREES"
  | "SUPERSEDED"
  | "CONTEXT_ONLY"
  | "SELLER_SUPPLIED";

export function evidenceDisposition(x: StatusExplanation, e: Evidence): EvidenceDisposition {
  if (x.sellerSuppliedEvidenceIds.includes(e.id)) return "SELLER_SUPPLIED";
  if (x.disagreeingEvidenceIds.includes(e.id)) return "DISAGREES";
  if (x.supportingEvidenceIds.includes(e.id)) return "SUPPORTS";
  if (x.supersededEvidenceIds.includes(e.id)) return "SUPERSEDED";
  return "CONTEXT_ONLY";
}

export const DISPOSITION_LABEL: Record<EvidenceDisposition, string> = {
  SUPPORTS: "Supports the CRM value",
  DISAGREES: "Disagrees with the CRM value",
  SUPERSEDED: "Superseded by later, more authoritative evidence",
  CONTEXT_ONLY: "Context only: not an accepted authority",
  SELLER_SUPPLIED: "Seller-supplied: not customer evidence",
};
