/**
 * Workbook publication gate (System_Design §Publication).
 * Schema/simulation first. A published rule needs predicates, groups, timing,
 * evidence, source, and positive/negative/boundary tests. Unresolved
 * renewal/alternative blocks that rule only. Catalog-wide Release_Gaps and
 * the generic review publication_gap do not blanket-lock verified rules.
 * STAGE1_ACTIVATION_LOCKED still blocks silent claim rejection — not publish.
 */

import type { DraftRule, RuleTestKind } from "./types.ts";
import { sourceIndexGrantsPublication } from "./source.ts";

export const PUBLICATION_GAP_KEYS = [
  "predicates",
  "group_logic",
  "timing",
  "evidence_acceptance",
  "source_link",
  "positive_test",
  "negative_test",
  "boundary_test",
  "unresolved_alternatives",
  "unresolved_renewals",
  "publication_gap",
  "release_gaps",
  "lifecycle_not_reviewed",
  "missing_approval",
  "not_published_flag",
  "source_index_is_not_permission",
] as const;

/** Workbook-wide gaps. They stay listed on the catalog; they do not block an unrelated verified rule. */
export const CATALOG_WIDE_RELEASE_GAP_IDS = [
  "WORKBOOK-GAP-01",
  "WORKBOOK-GAP-09",
  "WORKBOOK-GAP-11",
  "WORKBOOK-GAP-12",
] as const;

const GENERIC_REVIEW_PUBLICATION_GAP =
  /approve source interpretation,\s*typed predicates,\s*due-date anchor,\s*evidence criteria and tests before activating/i;

export function isGenericReviewPublicationGap(value: string | null | undefined): boolean {
  return !!value && GENERIC_REVIEW_PUBLICATION_GAP.test(value.trim());
}

export function isCatalogWideReleaseGap(gap: string): boolean {
  const text = gap.trim();
  if (!text) return false;
  if (CATALOG_WIDE_RELEASE_GAP_IDS.some((id) => text === id || text.startsWith(`${id}:`))) {
    return true;
  }
  const n = text.toLowerCase();
  if (/narrative fields are not tested executable predicates/.test(n)) return true;
  if (/inline roman numerals combine multiple obligations/.test(n)) return true;
  if (/1,693 retained rows/.test(n)) return true;
  if (/design controls do not establish deployed hipaa/.test(n)) return true;
  return false;
}

export function ruleSpecificReleaseGaps(gaps: readonly string[]): string[] {
  return gaps.filter((gap) => !isCatalogWideReleaseGap(gap));
}

export type PublicationGapKey = (typeof PUBLICATION_GAP_KEYS)[number];

export type PublicationGap = {
  key: PublicationGapKey;
  reason: string;
};

function hasTest(rule: DraftRule, kind: RuleTestKind): boolean {
  return rule.tests.some((t) => t.kind === kind && t.assert.trim().length > 0);
}

function timingPresent(rule: DraftRule): boolean {
  if (!rule.timing) return false;
  if (rule.timing.kind === "none") return rule.timing.reason.trim().length > 0;
  if (rule.timing.kind === "hire_plus_days") return Number.isFinite(rule.timing.days);
  if (rule.timing.kind === "employment_year") return rule.timing.startYear >= 1;
  if (rule.timing.kind === "certificate_expiry") return rule.timing.certKey.trim().length > 0;
  if (rule.timing.kind === "usor_cohort") {
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(rule.timing.cutover) &&
      /^\d{4}-\d{2}-\d{2}$/.test(rule.timing.existingDeadline) &&
      Number.isFinite(rule.timing.awardPlusMonths) &&
      rule.timing.awardPlusMonths >= 1
    );
  }
  if (rule.timing.kind === "calendar_period") {
    return rule.timing.cadence === "monthly" || rule.timing.cadence === "quarterly";
  }
  return false;
}

function evidencePresent(rule: DraftRule): boolean {
  return (
    rule.evidence.summary.trim().length > 0 &&
    rule.evidence.routes.length > 0 &&
    rule.evidence.defaultHandlingLabel.trim().length > 0 &&
    rule.evidence.automaticEquivalency === false
  );
}

function sourcePresent(rule: DraftRule): boolean {
  return (
    rule.source.sourceId.trim().length > 0 &&
    rule.source.sourceVersion.trim().length > 0 &&
    rule.source.sourceHash.trim().length > 0 &&
    rule.source.clauseIds.length > 0
  );
}

function groupPresent(rule: DraftRule): boolean {
  const hasMembers = rule.group.members.length > 0;
  const hasRoutes = (rule.group.routes?.length ?? 0) > 0;
  const routesOk =
    !hasRoutes ||
    rule.group.routes!.every(
      (route) => route.conditions.length > 0 && route.officialProgram.trim().length > 0,
    );
  return (
    (rule.group.logic === "ALL" ||
      rule.group.logic === "ANY" ||
      rule.group.logic === "CONDITIONAL") &&
    (hasMembers || hasRoutes) &&
    routesOk &&
    (rule.group.parentAssignment === "one" || rule.group.parentAssignment === "per_member")
  );
}

/** Structural + unresolved gaps. Does not grant activation. */
export function structuralPublicationGaps(rule: DraftRule): PublicationGap[] {
  const gaps: PublicationGap[] = [];
  if (rule.predicates.length === 0) {
    gaps.push({ key: "predicates", reason: "Rule has no applicability predicates." });
  }
  if (!groupPresent(rule)) {
    gaps.push({
      key: "group_logic",
      reason: "Rule is missing ALL/ANY/conditional group members.",
    });
  }
  if (!timingPresent(rule)) {
    gaps.push({
      key: "timing",
      reason: "Rule is missing an explicit timing anchor (or an explicit none).",
    });
  }
  if (!evidencePresent(rule)) {
    gaps.push({
      key: "evidence_acceptance",
      reason: "Rule is missing evidence acceptance (routes + handling label, no auto-equivalency).",
    });
  }
  if (!sourcePresent(rule)) {
    gaps.push({
      key: "source_link",
      reason: "Rule is missing an immutable source version/hash and clause ids.",
    });
  }
  if (!hasTest(rule, "positive")) {
    gaps.push({ key: "positive_test", reason: "Rule is missing a positive test." });
  }
  if (!hasTest(rule, "negative")) {
    gaps.push({ key: "negative_test", reason: "Rule is missing a negative test." });
  }
  if (!hasTest(rule, "boundary")) {
    gaps.push({ key: "boundary_test", reason: "Rule is missing a boundary test." });
  }
  if (rule.unresolvedAlternatives.length > 0) {
    gaps.push({
      key: "unresolved_alternatives",
      reason: `Unresolved alternatives: ${rule.unresolvedAlternatives.join("; ")}`,
    });
  }
  if (rule.unresolvedRenewals.length > 0) {
    gaps.push({
      key: "unresolved_renewals",
      reason: `Unresolved renewals: ${rule.unresolvedRenewals.join("; ")}`,
    });
  }
  if (
    rule.publicationGap &&
    rule.publicationGap.trim().length > 0 &&
    !isGenericReviewPublicationGap(rule.publicationGap)
  ) {
    gaps.push({
      key: "publication_gap",
      reason: `publication_gap is set (do not invent a fix): ${rule.publicationGap}`,
    });
  }
  const specificGaps = ruleSpecificReleaseGaps(rule.releaseGaps);
  if (specificGaps.length > 0) {
    gaps.push({
      key: "release_gaps",
      reason: `Release_Gaps (do not invent a fix): ${specificGaps.join("; ")}`,
    });
  }
  return gaps;
}

export function activationBlockReasons(rule: DraftRule): PublicationGap[] {
  const gaps = [...structuralPublicationGaps(rule)];
  if (rule.lifecycle !== "reviewed" && rule.lifecycle !== "published") {
    gaps.push({
      key: "lifecycle_not_reviewed",
      reason: `Lifecycle is ${rule.lifecycle}; publication needs reviewed (or published) plus approval.`,
    });
  }
  if (!rule.approval) {
    gaps.push({
      key: "missing_approval",
      reason: "Publication needs an explicit approval actor and date.",
    });
  }
  if (rule.publication !== "published") {
    gaps.push({
      key: "not_published_flag",
      reason: "Publication flag is not_published.",
    });
  }
  if (sourceIndexGrantsPublication(rule.sourceIndex)) {
    gaps.push({
      key: "source_index_is_not_permission",
      reason: "Source_index label is archive metadata, not publication permission.",
    });
  }
  return gaps;
}

export function publicationGaps(rule: DraftRule): PublicationGap[] {
  return activationBlockReasons(rule);
}

/**
 * Structural publishability for THIS rule: predicates, group, timing,
 * evidence, source, tests, and no unresolved alternatives/renewals or
 * rule-specific gaps. Catalog-wide Release_Gaps do not fail this.
 */
export function canPublish(rule: DraftRule): boolean {
  return structuralPublicationGaps(rule).length === 0;
}

/**
 * Live activation for one verified rule. Unpublished siblings stay draft.
 * Source_index never grants this. Claim auto-reject stays locked separately.
 */
export function canActivate(rule: DraftRule): boolean {
  if (rule.lifecycle !== "published") return false;
  if (rule.publication !== "published") return false;
  if (!rule.approval) return false;
  if (sourceIndexGrantsPublication(rule.sourceIndex)) return false;
  return canPublish(rule);
}

export function draftRuleAdminRow(rule: DraftRule): {
  id: string;
  title: string;
  lifecycle: DraftRule["lifecycle"];
  publication: DraftRule["publication"];
  canPublish: boolean;
  canActivate: boolean;
  gaps: PublicationGap[];
  clauseIds: string[];
} {
  return {
    id: rule.id,
    title: rule.title,
    lifecycle: rule.lifecycle,
    publication: rule.publication,
    canPublish: canPublish(rule),
    canActivate: canActivate(rule),
    gaps: publicationGaps(rule),
    clauseIds: rule.source.clauseIds,
  };
}
