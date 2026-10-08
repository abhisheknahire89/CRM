import { DEFAULT_POLICY_RULES, getDefinition, getRule } from "@/domain/policies";
import { computeClaimStatus, stampEvidence } from "@/domain/statusEngine";
import type { ClaimDefinitionId, ClaimValue, RawEvidence, SpeakerRole, EvidenceSourceType } from "@/domain/types";

export const NOW = "2026-10-08T09:00:00Z";

let n = 0;
export function raw(
  def: ClaimDefinitionId,
  o: {
    role: SpeakerRole;
    at: string;
    value: ClaimValue;
    type?: EvidenceSourceType;
    conf?: number;
    id?: string;
    speaker?: string;
  },
): RawEvidence {
  n++;
  return {
    id: o.id ?? `e${n}`,
    claimId: `t:${def}`,
    sourceType: o.type ?? "CUSTOMER_EMAIL",
    sourceId: `s${n}`,
    speaker: o.speaker ?? `Speaker ${n}`,
    speakerRole: o.role,
    speakerRoleBasis: "AI_PROPOSED",
    timestamp: o.at,
    quote: "q",
    structuredValue: o.value,
    extractionConfidence: o.conf ?? 0.95,
  };
}

/** Run the policy exactly as the repository does. */
export function compute(def: ClaimDefinitionId, crm: ClaimValue, evidence: RawEvidence[], now = NOW, freshnessDays?: number) {
  const definition = getDefinition(def);
  const base = getRule(DEFAULT_POLICY_RULES, def);
  const rule = freshnessDays ? { ...base, freshnessDays } : base;
  return computeClaimStatus({ definition, rule, crmValue: crm, evidence: stampEvidence(rule, evidence), now });
}
