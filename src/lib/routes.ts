import type { UserRole } from "@/domain/types";
import { DEMO_MANAGER_ID, DEMO_REP_ID, DEMO_REVOPS_ID } from "@/data/demoData";

/** Manager routes live at the root; the rep-first view is a dedicated route tree. */
export const routes = {
  queue: (role: UserRole) => (role === "REP" ? "/rep/" : "/"),
  deal: (role: UserRole, dealId: string) => (role === "REP" ? `/rep/deals/${dealId}/` : `/deals/${dealId}/`),
  claim: (role: UserRole, dealId: string, definitionId: string) =>
    role === "REP" ? `/rep/deals/${dealId}/claims/${definitionId}/` : `/deals/${dealId}/claims/${definitionId}/`,
  revops: "/revops/",
};

/** The signed-in user for each prototype role (no auth in the prototype). */
export const CURRENT_USER_ID: Record<UserRole, string> = {
  MANAGER: DEMO_MANAGER_ID,
  REP: DEMO_REP_ID,
  REVOPS: DEMO_REVOPS_ID,
};

export function roleFromPath(pathname: string): UserRole {
  if (pathname.startsWith("/rep")) return "REP";
  if (pathname.startsWith("/revops")) return "REVOPS";
  return "MANAGER";
}
