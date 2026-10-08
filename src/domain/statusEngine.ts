import { formatClaimValue, formatDate, ROLE_LABEL } from "./format";
import type {
  AuthorityLevel,
  ClaimDefinition,
  ClaimValue,
  ComputedStatus,
  Evidence,
  PolicyRule,
  RawEvidence,
  StatusExplanation,
  StatusReasonCode,
} from "./types";

/**
 * POLICY COMPUTES — the deterministic status engine. Implements PRODUCT_CONTRACT §4.
 *
 * Inputs are exactly: definition, rule, CRM value, evidence, clock.
 * It deliberately has NO parameter for a HumanDecision (I-3) and never reads
 * `extractionConfidence` (I-4). Both are enforced by the signature and by tests.
 */

const DAY_MS = 86_400_000;

export const ageInDays = (iso: string, now: string): number =>
  Math.floor((Date.parse(now) - Date.parse(iso)) / DAY_MS);

/** Authority rank within a rule: lower is higher. -1 = not an accepted authority. */
export const authorityRank = (rule: PolicyRule, e: Pick<RawEvidence, "speakerRole">): number =>
  rule.acceptedAuthorities.indexOf(e.speakerRole);

/** Seller-side material is never customer evidence (I-7). */
const isSellerSupplied = (e: Pick<RawEvidence, "speakerRole" | "sourceType">): boolean =>
  e.speakerRole === "SELLER_REP" || e.sourceType === "CRM_NOTE" || e.sourceType === "SELLER_ATTACHMENT";

export function classifyAuthority(
  rule: PolicyRule,
  e: Pick<RawEvidence, "speakerRole" | "sourceType">,
): AuthorityLevel {
  if (isSellerSupplied(e)) return "SELLER_SUPPLIED";
  if (rule.admissibleSourceTypes.includes(e.sourceType) && authorityRank(rule, e) >= 0) return "ACCEPTED";
  return "CUSTOMER_CONTEXT";
}

/** Stamps `authority` (policy) and `sequence` (time order within the claim) onto raw evidence. */
export function stampEvidence(rule: PolicyRule, raw: RawEvidence[]): Evidence[] {
  const ordered = [...raw].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.id.localeCompare(b.id),
  );
  return ordered.map((e, i) => ({ ...e, authority: classifyAuthority(rule, e), sequence: i + 1 }));
}

/** §4.1 admissibility. Needs a structured value the policy can compare. */
export const isAdmissible = (rule: PolicyRule, e: Evidence): boolean =>
  classifyAuthority(rule, e) === "ACCEPTED" && e.structuredValue !== null;

/** Does this evidence agree with the CRM value under the claim's match mode? */
export function valueMatches(def: ClaimDefinition, crm: ClaimValue, evidenceValue: ClaimValue): boolean {
  if (crm === null || crm === undefined) return true; // the CRM asserts nothing; evidence defines the claim
  if (evidenceValue === null || evidenceValue === undefined) return false;
  if (def.matchMode === "EQUALS") return evidenceValue === crm;
  // AT_MOST: weeks (number) or ISO dates (lexicographic = chronological for YYYY-MM-DD)
  return typeof crm === "number"
    ? Number(evidenceValue) <= crm
    : String(evidenceValue).slice(0, 10) <= String(crm).slice(0, 10);
}

/** Best = highest authority, then latest. */
function best(rule: PolicyRule, list: Evidence[]): Evidence | undefined {
  return [...list].sort(
    (a, b) => authorityRank(rule, a) - authorityRank(rule, b) || Date.parse(b.timestamp) - Date.parse(a.timestamp),
  )[0];
}

const who = (e: Evidence) => `${e.speaker} (${ROLE_LABEL[e.speakerRole]})`;

const latest = (list: Evidence[]): Evidence | undefined =>
  [...list].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];

export interface ComputeInput {
  definition: ClaimDefinition;
  rule: PolicyRule;
  crmValue: ClaimValue;
  evidence: Evidence[];
  /** Evaluation clock (ISO). Injected for determinism. */
  now: string;
}

export function computeClaimStatus(input: ComputeInput): StatusExplanation {
  const { definition: def, rule, crmValue, evidence, now } = input;
  const hasCrm = crmValue !== null && crmValue !== undefined;
  const fmt = (v: ClaimValue) => formatClaimValue(def, v);
  const accepted = rule.acceptedAuthorities.map((r) => ROLE_LABEL[r]).join(" / ");

  const admissible = evidence.filter((e) => isAdmissible(rule, e));
  const sellerSupplied = evidence.filter((e) => e.authority === "SELLER_SUPPLIED");
  const contextOnly = evidence.filter((e) => e.authority === "CUSTOMER_CONTEXT" || (e.authority === "ACCEPTED" && !isAdmissible(rule, e)));

  const supporting = admissible.filter((e) => valueMatches(def, crmValue, e.structuredValue));
  const disagreeing = admissible.filter((e) => !valueMatches(def, crmValue, e.structuredValue));

  const base = {
    freshnessDays: rule.freshnessDays,
    ruleVersion: rule.version,
    evaluatedAt: now,
    supportingEvidenceIds: supporting.map((e) => e.id),
    disagreeingEvidenceIds: disagreeing.map((e) => e.id),
    contextEvidenceIds: contextOnly.map((e) => e.id),
    sellerSuppliedEvidenceIds: sellerSupplied.map((e) => e.id),
  };
  const make = (
    status: ComputedStatus,
    reasonCode: StatusReasonCode,
    reason: string,
    headline: string,
    controlling: Evidence | undefined,
    extra: Partial<StatusExplanation> = {},
  ): StatusExplanation => ({
    ...base,
    status,
    reasonCode,
    reason,
    headline,
    controllingEvidenceId: controlling?.id ?? null,
    supersededEvidenceIds: [],
    evidenceAgeDays: supporting.length ? ageInDays(latest(supporting)!.timestamp, now) : null,
    ...extra,
  });

  // 2. nothing admissible
  if (admissible.length === 0) {
    if (!hasCrm && evidence.length === 0) {
      return make("UNKNOWN", "UNKNOWN_NO_CLAIM_NO_EVIDENCE", "Nobody has claimed this and no evidence exists in connected sources.", "Nobody has claimed this, and there is no evidence.", undefined);
    }
    let why: string;
    let head: string;
    if (contextOnly.length > 0) {
      head = "Customer evidence exists, but not from an accepted authority.";
      const who = [...new Set(contextOnly.map((e) => ROLE_LABEL[e.speakerRole]))].join(", ");
      why = `The CRM says ${fmt(crmValue)}. Customer evidence exists (${who}), but not from an accepted authority (${accepted}), so it is context, not support.`;
    } else if (sellerSupplied.length > 0) {
      head = "Only seller-supplied context. No customer evidence in connected sources.";
      why = `The CRM says ${fmt(crmValue)}. The only evidence is seller-supplied, which is not customer evidence. No admissible customer-side ${def.shortLabel.toLowerCase()} evidence in connected sources.`;
    } else {
      head = "No customer evidence in connected sources.";
      why = `The CRM says ${fmt(crmValue)}, but no admissible customer evidence exists in connected sources.`;
    }
    return make("UNSUPPORTED", "UNSUPPORTED_NO_ADMISSIBLE_EVIDENCE", why, head, undefined);
  }

  const bestSupport = best(rule, supporting);
  const bestDisagree = best(rule, disagreeing);

  // 6 / 7. disagreement
  if (bestDisagree) {
    const d = bestDisagree;
    const s = bestSupport;
    // The thing d is compared against: admissible support first, else customer context that agreed with the CRM.
    const agreeingContext = contextOnly.filter((e) => valueMatches(def, crmValue, e.structuredValue));
    const target = s ?? best(rule, agreeingContext) ?? latest(agreeingContext);
    const targetRank = target ? authorityRank(rule, target) : -1;
    const dRank = authorityRank(rule, d);
    const later = target ? Date.parse(d.timestamp) > Date.parse(target.timestamp) : true;
    const higher = target ? (targetRank === -1 ? true : dRank < targetRank) : false;

    const overrides = !s || later || higher;
    if (overrides) {
      const qualifiers = [later && target ? "Later" : null, higher && target ? "more authoritative" : null]
        .filter(Boolean)
        .join(", ");
      const noun = def.shortLabel.toLowerCase();
      const prefix = qualifiers ? `${qualifiers} ${noun} evidence disagrees` : `Admissible ${noun} evidence disagrees with the CRM`;
      const earlier = target
        ? ` Earlier: ${who(target)} ${s ? "supported it" : "said " + fmt(target.structuredValue)} on ${formatDate(target.timestamp)}.`
        : "";
      const reason = `${prefix}: ${who(d)} states ${fmt(d.structuredValue)} on ${formatDate(d.timestamp)}; the CRM says ${fmt(crmValue)}.${earlier}`;
      return make(
        "CONTRADICTED",
        target ? "CONTRADICTED_LATER_OR_HIGHER_AUTHORITY" : "CONTRADICTED_NO_SUPPORT",
        reason,
        `${prefix}.`,
        d,
        { supersededEvidenceIds: target && !s ? [target.id] : [] },
      );
    }
    // earlier and lower authority than the supporting evidence: history only, falls through to freshness
  }

  // 5. supported, but is it fresh?
  const newest = latest(supporting)!;
  const age = ageInDays(newest.timestamp, now);
  if (age > rule.freshnessDays) {
    return make(
      "STALE",
      "STALE_EVIDENCE_OUTSIDE_WINDOW",
      `${who(newest)} supported this on ${formatDate(newest.timestamp)}, ${age} days ago. The freshness window for this claim is ${rule.freshnessDays} days.`,
      `Supporting evidence is ${age} days old; the window is ${rule.freshnessDays} days.`,
      bestSupport,
    );
  }
  return make(
    "SUPPORTED",
    "SUPPORTED_ACCEPTED_AUTHORITY",
    `Admissible evidence from ${who(bestSupport!)} on ${formatDate(bestSupport!.timestamp)}, within the ${rule.freshnessDays}-day freshness window; nothing later or more authoritative disagrees.`,
    `Supported by ${ROLE_LABEL[bestSupport!.speakerRole]} evidence from ${formatDate(bestSupport!.timestamp)}.`,
    bestSupport,
  );
}
