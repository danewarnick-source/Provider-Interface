/**
 * Per-rule publication overlay. Imported catalog rows stay draft until an
 * explicit approval is recorded here. Unrelated workbook Release_Gaps are
 * not a publish bit. No tenant write — Soft would need a table to persist
 * approvals outside git.
 */

import type { ApprovalRecord, DraftRule } from "./types.ts";
import { structuralPublicationGaps, type PublicationGap } from "./publication.ts";

export type VerifiedPublication = {
  ruleId: string;
  approval: ApprovalRecord;
};

/** Empty until a rule is individually verified. Do not bulk-fill. */
export const VERIFIED_PUBLICATIONS: readonly VerifiedPublication[] = [];

export function verifiedPublicationFor(ruleId: string): VerifiedPublication | null {
  return VERIFIED_PUBLICATIONS.find((row) => row.ruleId === ruleId) ?? null;
}

/**
 * Publish one structurally complete rule. Returns the unchanged rule plus
 * gaps when the rule is not ready. Never publishes siblings.
 */
export function applyVerifiedPublication(
  rule: DraftRule,
  approval: ApprovalRecord,
): { rule: DraftRule; gaps: PublicationGap[] } {
  const gaps = structuralPublicationGaps(rule);
  if (gaps.length > 0) return { rule, gaps };
  if (!approval.actorId.trim() || !approval.actorLabel.trim() || !approval.approvedAt.trim()) {
    return {
      rule,
      gaps: [
        {
          key: "missing_approval",
          reason: "Publication needs an explicit approval actor and date.",
        },
      ],
    };
  }
  return {
    rule: {
      ...rule,
      lifecycle: "published",
      publication: "published",
      approval,
    },
    gaps: [],
  };
}

export function applyVerifiedPublicationOverlay<T extends DraftRule>(rules: readonly T[]): T[] {
  return rules.map((rule) => {
    const overlay = verifiedPublicationFor(rule.id);
    if (!overlay) return rule;
    const next = applyVerifiedPublication(rule, overlay.approval);
    return next.gaps.length === 0 ? (next.rule as T) : rule;
  });
}
