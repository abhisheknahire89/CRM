import type { Claim, Deal, ForecastCategory, ReviewPriority, StatusCounts } from "./types";

/** Policy: queue inclusion and review priority. Deterministic. PRODUCT_CONTRACT §8. */

export function countStatuses(claims: Pick<Claim, "computedStatus">[]): StatusCounts {
  const c: StatusCounts = { SUPPORTED: 0, UNSUPPORTED: 0, CONTRADICTED: 0, STALE: 0, UNKNOWN: 0 };
  for (const cl of claims) c[cl.computedStatus]++;
  return c;
}

const isReviewable = (f: ForecastCategory) => f === "COMMIT" || f === "BEST_CASE";

/** Deck slide 5: Commit or Best Case with an unsupported or contradicted claim. STALE alone does not qualify (D-05). */
export function needsReview(forecast: ForecastCategory, counts: StatusCounts): boolean {
  return isReviewable(forecast) && counts.UNSUPPORTED + counts.CONTRADICTED > 0;
}

export function reviewPriority(forecast: ForecastCategory, counts: StatusCounts): ReviewPriority {
  const { CONTRADICTED: x, UNSUPPORTED: u } = counts;
  if (forecast === "COMMIT") {
    if (x >= 1 || u >= 2) return "HIGH";
    if (u === 1) return "MEDIUM";
    return "LOW";
  }
  if (forecast === "BEST_CASE") return x >= 1 || u >= 2 ? "MEDIUM" : "LOW";
  return "LOW";
}

const PRIORITY_ORDER: Record<ReviewPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export interface QueueSortable {
  deal: Pick<Deal, "valueUsd">;
  priority: ReviewPriority;
  counts: StatusCounts;
}

/** priority, then flagged claims desc, then contradicted desc, then deal value desc. */
export function compareQueue(a: QueueSortable, b: QueueSortable): number {
  const flags = (q: QueueSortable) => q.counts.CONTRADICTED + q.counts.UNSUPPORTED;
  return (
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
    flags(b) - flags(a) ||
    b.counts.CONTRADICTED - a.counts.CONTRADICTED ||
    b.deal.valueUsd - a.deal.valueUsd
  );
}
