/**
 * Soft=none controlled publish path.
 * Wiring is not publication. A verified executable rule enters
 * VERIFIED_PUBLICATIONS only when proposed here with an explicit
 * approval and zero structural gaps. Unresolved stay draft with reasons.
 * No tenant table. No global flip.
 */

import type { PublicationGap } from "./publication.ts";
import type { ApprovalRecord, DraftRule } from "./types.ts";
import {
  applyVerifiedPublication,
  VERIFIED_PUBLICATIONS,
  type VerifiedPublication,
} from "./verified-publication.ts";

export type UnresolvedPublication = {
  ruleId: string;
  reasons: string[];
  gaps: PublicationGap[];
};

export type ControlledPublicationDecision = {
  accepted: VerifiedPublication[];
  unresolved: UnresolvedPublication[];
};

/**
 * Propose one rule or a named batch. Never touches unrequested siblings.
 * Does not write VERIFIED_PUBLICATIONS.
 */
export function proposeVerifiedPublications(
  rules: readonly DraftRule[],
  requestedIds: readonly string[],
  approval: ApprovalRecord,
): ControlledPublicationDecision {
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const accepted: VerifiedPublication[] = [];
  const unresolved: UnresolvedPublication[] = [];
  const seen = new Set<string>();
  for (const ruleId of requestedIds) {
    if (seen.has(ruleId)) continue;
    seen.add(ruleId);
    const rule = byId.get(ruleId);
    if (!rule) {
      unresolved.push({
        ruleId,
        reasons: ["Rule is not in the loaded catalog."],
        gaps: [],
      });
      continue;
    }
    const next = applyVerifiedPublication(rule, approval);
    if (next.gaps.length > 0) {
      unresolved.push({
        ruleId,
        reasons: next.gaps.map((gap) => gap.reason),
        gaps: next.gaps,
      });
      continue;
    }
    accepted.push({ ruleId, approval });
  }
  return { accepted, unresolved };
}

/** Append accepted rows. Never wipes the existing overlay. */
export function mergeVerifiedPublications(
  existing: readonly VerifiedPublication[],
  incoming: readonly VerifiedPublication[],
): VerifiedPublication[] {
  const byId = new Map(existing.map((row) => [row.ruleId, row]));
  for (const row of incoming) {
    if (!byId.has(row.ruleId)) byId.set(row.ruleId, row);
  }
  return [...byId.values()];
}

/**
 * Gate for the committed overlay. Empty is valid. A listed row that cannot
 * publish stays draft and fails this gate — do not leave a dead approval.
 */
export function committedPublicationIssues(
  rules: readonly DraftRule[],
  publications: readonly VerifiedPublication[] = VERIFIED_PUBLICATIONS,
): UnresolvedPublication[] {
  if (publications.length === 0) return [];
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const issues: UnresolvedPublication[] = [];
  for (const row of publications) {
    const rule = byId.get(row.ruleId);
    if (!rule) {
      issues.push({
        ruleId: row.ruleId,
        reasons: ["Rule is not in the loaded catalog."],
        gaps: [],
      });
      continue;
    }
    const next = applyVerifiedPublication(rule, row.approval);
    if (next.gaps.length > 0) {
      issues.push({
        ruleId: row.ruleId,
        reasons: next.gaps.map((gap) => gap.reason),
        gaps: next.gaps,
      });
    }
  }
  return issues;
}

export function formatVerifiedPublicationSnippet(row: VerifiedPublication): string {
  return `{ ruleId: ${JSON.stringify(row.ruleId)}, approval: { actorId: ${JSON.stringify(row.approval.actorId)}, actorLabel: ${JSON.stringify(row.approval.actorLabel)}, approvedAt: ${JSON.stringify(row.approval.approvedAt)} } }`;
}
