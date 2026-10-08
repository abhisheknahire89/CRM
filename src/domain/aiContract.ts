import type {
  ClaimDefinitionId,
  ClaimValue,
  RawEvidence,
  SpeakerRole,
  EvidenceSourceType,
} from "./types";

/**
 * AI INTERPRETS — the wire format of the extraction step.
 *
 * This is everything the probabilistic layer is allowed to return. Note what is *absent*:
 * no business status, no win/loss, no recommended forecast. The policy layer computes those.
 * The Engineering Approach's AI-output example is this shape, and the prototype's demo data is
 * written in it, so the prototype and the production design share one boundary.
 */
export interface AiExtraction {
  extraction_id: string;
  deal_id: string;
  claim_definition: ClaimDefinitionId;
  source_id: string;
  source_type: EvidenceSourceType;
  /** Exact quote, verbatim from the source. */
  quote: string;
  speaker: string;
  /** A candidate. The policy decides what the role is worth; a rep can dispute it. */
  speaker_role_candidate: SpeakerRole;
  timestamp: string;
  /** Dates/durations structured by the model, e.g. `4` (weeks) or `"2026-11-12"`. */
  structured_value: ClaimValue;
  /** Confidence in the *extraction*. Never an input to business status. */
  extraction_confidence: number;
  /** Ids of other extractions this one may conflict with. A hint only: policy decides. */
  candidate_conflicts: string[];
  model_version: string;
  prompt_version: string;
}

export const claimIdFor = (dealId: string, definitionId: ClaimDefinitionId) =>
  `${dealId}:${definitionId}`;

/** Maps AI output to the evidence record. Authority and sequence are stamped later, by policy. */
export function toRawEvidence(x: AiExtraction): RawEvidence {
  return {
    id: x.extraction_id,
    claimId: claimIdFor(x.deal_id, x.claim_definition),
    sourceType: x.source_type,
    sourceId: x.source_id,
    speaker: x.speaker,
    speakerRole: x.speaker_role_candidate,
    speakerRoleBasis: x.source_type === "SELLER_ATTACHMENT" ? "SELLER_ATTACHED" : "AI_PROPOSED",
    timestamp: x.timestamp,
    quote: x.quote,
    structuredValue: x.structured_value,
    extractionConfidence: x.extraction_confidence,
  };
}
