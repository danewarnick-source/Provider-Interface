// What a team member's Policies tab and Ask answers say about reviews (N6,
// Decision 4, worded as in the demo). Pure: no Supabase, no aliases, so
// node --test can import it.
//
// The list is getStaffReviewRecord's: every published policy and procedure
// meant for this person, current version, with their review of exactly that
// version or null. A new version asks them again.

import { formatInstant, groupLabel } from "./knowledge-view.ts";

export interface StaffPolicy {
  documentId: string;
  title: string;
  version: number;
  reviewedAt: string | null;
}

export type PolicyTone = "ok" | "warn";

/** "Needs review · v2" or "Reviewed Oct 3 · v2". */
export function policyStatus(policy: Pick<StaffPolicy, "version" | "reviewedAt">): {
  label: string;
  tone: PolicyTone;
} {
  if (policy.reviewedAt) {
    return {
      label: `Reviewed ${formatInstant(policy.reviewedAt, true)} · v${policy.version}`,
      tone: "ok",
    };
  }
  return { label: `Needs review · v${policy.version}`, tone: "warn" };
}

export function needsReviewCount(policies: readonly Pick<StaffPolicy, "reviewedAt">[]): number {
  return policies.filter((p) => !p.reviewedAt).length;
}

/** The line at the top of the Policies tab. */
export function policiesSummary(policies: readonly Pick<StaffPolicy, "reviewedAt">[]): string {
  if (policies.length === 0) return "No policies are meant for you yet.";
  const n = needsReviewCount(policies);
  if (n === 0) return "You're up to date on every policy.";
  return `${n} ${n === 1 ? "policy needs" : "policies need"} your review.`;
}

/** Shown instead of the button once this version is reviewed. */
export function reviewedText(version: number, reviewedAt: string): string {
  return `You reviewed version ${version} on ${formatInstant(reviewedAt)}`;
}

/** The line under a policy's name: "Agency policies · Version 2". */
export function policyMeta(group: string | null | undefined, version: number): string {
  return `${groupLabel(group)} · Version ${version}`;
}

export function markReviewedLabel(title: string): string {
  return `Mark "${title}" as reviewed`;
}

/**
 * The first policy an answer cites that is meant for this person and not yet
 * reviewed in its current version, for the "Mark … as reviewed" button.
 */
export function unreviewedCitedPolicy(
  sources: ReadonlyArray<{ kind: string; documentId: string | null }>,
  policies: readonly StaffPolicy[],
): StaffPolicy | null {
  for (const source of sources) {
    if (source.kind !== "library" || !source.documentId) continue;
    const policy = policies.find((p) => p.documentId === source.documentId);
    if (policy && !policy.reviewedAt) return policy;
  }
  return null;
}
