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

/**
 * Dane Soft=none named READY batch (2026-09-15T02:25:00.000Z).
 * Rows are propose snippets only. Do not invent DRAFT as READY.
 */
export const VERIFIED_PUBLICATIONS: readonly VerifiedPublication[] = [
  { ruleId: "REQ-1.4.1", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.4.2", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.6", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.7.1", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.7.2", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.8.4", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.8.5", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.8.6", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.8.7", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.8.8", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.9", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.9.2", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.9.4", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.9.7", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.10.7", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.10.11", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.11", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.12", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.13", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.13.2", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.14", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.18", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.21", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.22.c", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.23", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.24.5", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.25", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.28.5", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.28.7", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.28.7.G", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.28.9", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.30", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-1.35", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-11.3.5", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-11.3.9", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-11.5", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-15.3.7", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-21.3.1", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-21.5", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-28.4", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-30.3.4", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-30.5", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-30.6.a", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-30.6.b", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-30.6.c", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-32.3.2", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-32.5", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-33.3.4", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-33.5.b", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
  { ruleId: "REQ-33.5.c", approval: { actorId: "dane", actorLabel: "Dane", approvedAt: "2026-09-15T02:25:00.000Z" } },
];

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
