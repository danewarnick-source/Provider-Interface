/**
 * DHHS91172 catalog coverage: each imported requirement against the live
 * engine. Parents and elements are distinct rows. Children do not duplicate
 * parent staff tasks.
 */

import {
  catalogFactPrompts,
  evaluateCatalogFact,
  type CatalogFactQuestion,
} from "./catalog-fact-questions.ts";
import {
  implementationStatusForRule,
  liveObligationKeyForRule,
  staffTaskPolicyForRule,
  type LiveImplementationStatus,
} from "./catalog-live-bridge.ts";
import { EMPTY_ORG_FACTS, type OrgFacts } from "./applicability.ts";
import type {
  CatalogSheetRow,
  LoadedCatalog,
  LoadedDraftRule,
} from "./draft-rules/catalog-loader.ts";
import { canActivate, canPublish, structuralPublicationGaps } from "./draft-rules/publication.ts";
import type { DraftRule } from "./draft-rules/types.ts";
import { applyVerifiedPublicationOverlay } from "./draft-rules/verified-publication.ts";
import {
  applyFirstExecutableBatchOverlay,
  applyFirstExecutableBatchOverlayAll,
  firstBatchParentIsWired,
} from "./first-executable-batch.ts";
import {
  applySecondExecutableBatchOverlay,
  applySecondExecutableBatchOverlayAll,
  secondBatchParentIsWired,
} from "./second-executable-batch.ts";
import {
  applyThirdExecutableBatchOverlay,
  applyThirdExecutableBatchOverlayAll,
  thirdBatchParentIsWired,
} from "./third-executable-batch.ts";
import {
  applyFourthExecutableBatchOverlay,
  applyFourthExecutableBatchOverlayAll,
  fourthBatchParentIsWired,
} from "./fourth-executable-batch.ts";
import {
  applyFifthExecutableBatchOverlay,
  applyFifthExecutableBatchOverlayAll,
  fifthBatchParentIsWired,
} from "./fifth-executable-batch.ts";
import {
  applySixthExecutableBatchOverlay,
  applySixthExecutableBatchOverlayAll,
  sixthBatchParentIsWired,
} from "./sixth-executable-batch.ts";
import {
  applySeventhExecutableBatchOverlay,
  applySeventhExecutableBatchOverlayAll,
  seventhBatchParentIsWired,
} from "./seventh-executable-batch.ts";
import {
  applyEighthExecutableBatchOverlay,
  applyEighthExecutableBatchOverlayAll,
  eighthBatchParentIsWired,
} from "./eighth-executable-batch.ts";
import {
  applyMegaCExecutableBatchOverlay,
  applyMegaCExecutableBatchOverlayAll,
  megaCBatchParentIsWired,
} from "./mega-c-executable-batch.ts";
import {
  applyNinthExecutableBatchOverlay,
  applyNinthExecutableBatchOverlayAll,
  ninthBatchParentIsWired,
} from "./ninth-executable-batch.ts";
import {
  applyTenthExecutableBatchOverlay,
  applyTenthExecutableBatchOverlayAll,
  tenthBatchParentIsWired,
} from "./tenth-executable-batch.ts";
import {
  applyEleventhExecutableBatchOverlay,
  applyEleventhExecutableBatchOverlayAll,
  eleventhBatchParentIsWired,
} from "./eleventh-executable-batch.ts";
import {
  applyTwelfthExecutableBatchOverlay,
  applyTwelfthExecutableBatchOverlayAll,
  twelfthBatchParentIsWired,
} from "./twelfth-executable-batch.ts";
import {
  applyThirteenthExecutableBatchOverlay,
  applyThirteenthExecutableBatchOverlayAll,
  thirteenthBatchParentIsWired,
} from "./thirteenth-executable-batch.ts";
import {
  applyFourteenthExecutableBatchOverlay,
  applyFourteenthExecutableBatchOverlayAll,
  fourteenthBatchParentIsWired,
} from "./fourteenth-executable-batch.ts";
import {
  applyFifteenthExecutableBatchOverlay,
  applyFifteenthExecutableBatchOverlayAll,
  fifteenthBatchParentIsWired,
} from "./fifteenth-executable-batch.ts";
import {
  applySixteenthExecutableBatchOverlay,
  applySixteenthExecutableBatchOverlayAll,
  sixteenthBatchParentIsWired,
} from "./sixteenth-executable-batch.ts";

export type CatalogCoverageRow = {
  requirementKey: string;
  role: "parent" | "element";
  parentKey: string | null;
  title: string;
  sourceClauseId: string;
  sectionRef: string;
  applicabilityFacts: CatalogFactQuestion[];
  owner: string;
  completionMethod: string;
  timing: string;
  renewal: string;
  liveKey: string | null;
  implementationStatus: LiveImplementationStatus;
  publication: "not_published" | "published";
  canPublish: boolean;
  canActivate: boolean;
  mintsStaffTask: boolean;
  blockers: string[];
};

export type CatalogCoverageCounts = {
  importedParents: number;
  importedElements: number;
  importedRows: number;
  executable: number;
  verified: number;
  published: number;
  blocked: number;
  liveMapped: number;
  systemBehavior: number;
  draftUnwired: number;
  elementOfParent: number;
  /** Shared-behavior batches: live key + fixture overlay. */
  wired: number;
  wiredFirstBatch: number;
  wiredSecondBatch: number;
  wiredThirdBatch: number;
  wiredFourthBatch: number;
  wiredFifthBatch: number;
  wiredSixthBatch: number;
  wiredSeventhBatch: number;
  wiredEighthBatch: number;
  wiredMegaC: number;
  wiredNinthBatch: number;
  wiredTenthBatch: number;
  wiredEleventhBatch: number;
  wiredTwelfthBatch: number;
  wiredThirteenthBatch: number;
  wiredFourteenthBatch: number;
  wiredFifteenthBatch: number;
  wiredSixteenthBatch: number;
  remainingExecutable: number;
};

export type CatalogCoverageReport = {
  workbookSha256: string;
  counts: CatalogCoverageCounts;
  rows: CatalogCoverageRow[];
};

/** Fixture overlays only. Publication is a separate VERIFIED_PUBLICATIONS step. */
export function applyExecutableBatchOverlay<T extends DraftRule>(rule: T): T {
  return applySixteenthExecutableBatchOverlay(
    applyFifteenthExecutableBatchOverlay(
      applyFourteenthExecutableBatchOverlay(
        applyThirteenthExecutableBatchOverlay(
          applyTwelfthExecutableBatchOverlay(
            applyEleventhExecutableBatchOverlay(
              applyTenthExecutableBatchOverlay(
                applyNinthExecutableBatchOverlay(
                  applyMegaCExecutableBatchOverlay(
                    applyEighthExecutableBatchOverlay(
                      applySeventhExecutableBatchOverlay(
                        applySixthExecutableBatchOverlay(
                          applyFifthExecutableBatchOverlay(
                            applyFourthExecutableBatchOverlay(
                              applyThirdExecutableBatchOverlay(
                                applySecondExecutableBatchOverlay(applyFirstExecutableBatchOverlay(rule)),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

export function applyExecutableBatchOverlays<T extends DraftRule>(rules: readonly T[]): T[] {
  return applySixteenthExecutableBatchOverlayAll(
    applyFifteenthExecutableBatchOverlayAll(
      applyFourteenthExecutableBatchOverlayAll(
        applyThirteenthExecutableBatchOverlayAll(
          applyTwelfthExecutableBatchOverlayAll(
            applyEleventhExecutableBatchOverlayAll(
              applyTenthExecutableBatchOverlayAll(
                applyNinthExecutableBatchOverlayAll(
                  applyMegaCExecutableBatchOverlayAll(
                    applyEighthExecutableBatchOverlayAll(
                      applySeventhExecutableBatchOverlayAll(
                        applySixthExecutableBatchOverlayAll(
                          applyFifthExecutableBatchOverlayAll(
                            applyFourthExecutableBatchOverlayAll(
                              applyThirdExecutableBatchOverlayAll(
                                applySecondExecutableBatchOverlayAll(
                                  applyFirstExecutableBatchOverlayAll(rules),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

function cell(row: CatalogSheetRow | undefined, key: string): string {
  if (!row) return "";
  const value = row[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function timingLabel(rule: LoadedDraftRule): string {
  const deadline = cell(rule.workbookRow, "deadline");
  const trigger = cell(rule.workbookRow, "deadline_trigger");
  const recurrence = cell(rule.workbookRow, "recurrence");
  if (rule.timing.kind === "hire_plus_days") return `hire + ${rule.timing.days} days`;
  if (rule.timing.kind === "employment_year") return `employment year ${rule.timing.startYear}`;
  if (rule.timing.kind === "certificate_expiry")
    return `certificate expiry (${rule.timing.certKey})`;
  if (rule.timing.kind === "calendar_period") return rule.timing.cadence;
  const narrative = [deadline, trigger, recurrence].filter(Boolean).join(" / ");
  return narrative || rule.timing.reason;
}

function elementRow(el: CatalogSheetRow, parent: LoadedDraftRule | undefined): CatalogCoverageRow {
  const parentKey = cell(el, "requirement_key") || cell(el, "parent_id") || parent?.id || "";
  return {
    requirementKey: cell(el, "clause_id") || cell(el, "requirement_key"),
    role: "element",
    parentKey: parentKey || null,
    title: cell(el, "clause_text") || cell(el, "requirement_name") || cell(el, "title"),
    sourceClauseId: cell(el, "clause_id") || cell(el, "source_clause_id"),
    sectionRef: cell(el, "section_ref"),
    applicabilityFacts:
      parent?.applicabilityFacts.map((f) => evaluateCatalogFact(f, EMPTY_ORG_FACTS)) ?? [],
    owner:
      cell(el, "default_owner_role") ||
      cell(parent?.workbookRow, "default_owner_role") ||
      "Administrator",
    completionMethod: "Element of parent — checklist / form field, not a staff task",
    timing: cell(parent?.workbookRow, "deadline") || "Follows parent",
    renewal: cell(parent?.workbookRow, "renewal_rule") || "Follows parent",
    liveKey: parent ? liveObligationKeyForRule(parent) : null,
    implementationStatus: "element_of_parent",
    publication: "not_published",
    canPublish: false,
    canActivate: false,
    mintsStaffTask: false,
    blockers: ["Child element — do not mint a duplicate staff task."],
  };
}

function parentRow(rule: LoadedDraftRule, orgFacts: OrgFacts): CatalogCoverageRow {
  const executable = applyExecutableBatchOverlay(rule);
  const published = applyVerifiedPublicationOverlay([executable])[0] ?? executable;
  const gaps = structuralPublicationGaps(published);
  const policy = staffTaskPolicyForRule(published);
  const liveKey = liveObligationKeyForRule(published);
  const blocked = gaps.length > 0 && !liveKey;
  const status = implementationStatusForRule(
    published,
    gaps.some((g) => g.key === "publication_gap" || g.key === "release_gaps") && !liveKey,
  );
  const factQuestions = published.applicabilityFacts.map((f) => evaluateCatalogFact(f, orgFacts));
  const factPrompts = catalogFactPrompts(published.applicabilityFacts, orgFacts);
  const blockers = [
    ...gaps.map((g) => g.reason),
    ...(!liveKey && status === "draft_unwired"
      ? [
          "No live company_obligations key mapped yet — reuse the existing engine, do not fork a second checklist.",
        ]
      : []),
    ...factPrompts.map((q) => `Unanswered applicability fact: ${q}`),
  ];
  return {
    requirementKey: published.id,
    role: "parent",
    parentKey: null,
    title: published.title,
    sourceClauseId:
      published.source.clauseIds[0] ?? cell(published.workbookRow, "source_clause_id"),
    sectionRef: cell(published.workbookRow, "section_ref"),
    applicabilityFacts: factQuestions,
    owner: cell(published.workbookRow, "default_owner_role") || "Administrator",
    completionMethod:
      cell(published.workbookRow, "completion_method") ||
      published.evidence.summary ||
      published.completionRoutes.join(", "),
    timing: timingLabel(published),
    renewal: cell(published.workbookRow, "renewal_rule") || "None stated",
    liveKey,
    implementationStatus: status,
    publication: published.publication,
    canPublish: canPublish(published),
    canActivate: canActivate(published),
    mintsStaffTask: policy.mintsStaffTask && !liveKey && canActivate(published),
    blockers:
      blocked || status === "draft_unwired" || factPrompts.length > 0
        ? blockers
        : gaps.map((g) => g.reason),
  };
}

export function buildCatalogCoverageReport(
  loaded: LoadedCatalog,
  orgFacts: OrgFacts = EMPTY_ORG_FACTS,
): CatalogCoverageReport {
  const parents = applyVerifiedPublicationOverlay(applyExecutableBatchOverlays(loaded.parents));
  const byId = new Map(parents.map((p) => [p.id, p]));
  const parentRows = parents.map((rule) => parentRow(rule, orgFacts));
  const elementRows = loaded.elements.map((el) =>
    elementRow(el, byId.get(cell(el, "requirement_key") || cell(el, "parent_id"))),
  );
  const rows = [...parentRows, ...elementRows];
  const parentOnly = parentRows;
  const counts: CatalogCoverageCounts = {
    importedParents: parentOnly.length,
    importedElements: elementRows.length,
    importedRows: rows.length,
    executable: parentOnly.filter((r) => r.liveKey != null).length,
    verified: parentOnly.filter((r) => r.canActivate || r.publication === "published").length,
    published: parentOnly.filter((r) => r.publication === "published" && r.canActivate).length,
    blocked: parentOnly.filter((r) => r.implementationStatus === "blocked").length,
    liveMapped: parentOnly.filter((r) => r.implementationStatus === "live_mapped").length,
    systemBehavior: parentOnly.filter((r) => r.implementationStatus === "system_behavior").length,
    draftUnwired: parentOnly.filter((r) => r.implementationStatus === "draft_unwired").length,
    elementOfParent: elementRows.length,
    wiredFirstBatch: parents.filter((rule) => firstBatchParentIsWired(rule)).length,
    wiredSecondBatch: parents.filter((rule) => secondBatchParentIsWired(rule)).length,
    wiredThirdBatch: parents.filter((rule) => thirdBatchParentIsWired(rule)).length,
    wiredFourthBatch: parents.filter((rule) => fourthBatchParentIsWired(rule)).length,
    wiredFifthBatch: parents.filter((rule) => fifthBatchParentIsWired(rule)).length,
    wiredSixthBatch: parents.filter((rule) => sixthBatchParentIsWired(rule)).length,
    wiredSeventhBatch: parents.filter((rule) => seventhBatchParentIsWired(rule)).length,
    wiredEighthBatch: parents.filter((rule) => eighthBatchParentIsWired(rule)).length,
    wiredMegaC: parents.filter((rule) => megaCBatchParentIsWired(rule)).length,
    wiredNinthBatch: parents.filter((rule) => ninthBatchParentIsWired(rule)).length,
    wiredTenthBatch: parents.filter((rule) => tenthBatchParentIsWired(rule)).length,
    wiredEleventhBatch: parents.filter((rule) => eleventhBatchParentIsWired(rule)).length,
    wiredTwelfthBatch: parents.filter((rule) => twelfthBatchParentIsWired(rule)).length,
    wiredThirteenthBatch: parents.filter((rule) => thirteenthBatchParentIsWired(rule)).length,
    wiredFourteenthBatch: parents.filter((rule) => fourteenthBatchParentIsWired(rule)).length,
    wiredFifteenthBatch: parents.filter((rule) => fifteenthBatchParentIsWired(rule)).length,
    wiredSixteenthBatch: parents.filter((rule) => sixteenthBatchParentIsWired(rule)).length,
    wired: parents.filter(
      (rule) =>
        firstBatchParentIsWired(rule) ||
        secondBatchParentIsWired(rule) ||
        thirdBatchParentIsWired(rule) ||
        fourthBatchParentIsWired(rule) ||
        fifthBatchParentIsWired(rule) ||
        sixthBatchParentIsWired(rule) ||
        seventhBatchParentIsWired(rule) ||
        eighthBatchParentIsWired(rule) ||
        megaCBatchParentIsWired(rule) ||
        ninthBatchParentIsWired(rule) ||
        tenthBatchParentIsWired(rule) ||
        eleventhBatchParentIsWired(rule) ||
        twelfthBatchParentIsWired(rule) ||
        thirteenthBatchParentIsWired(rule) ||
        fourteenthBatchParentIsWired(rule) ||
        fifteenthBatchParentIsWired(rule) ||
        sixteenthBatchParentIsWired(rule),
    ).length,
    remainingExecutable: parentOnly.filter((r) => r.liveKey != null && r.canPublish === false)
      .length,
  };
  return {
    workbookSha256: loaded.manifest.sha256,
    counts,
    rows,
  };
}

function remainingExecutableParents(report: CatalogCoverageReport): CatalogCoverageRow[] {
  return report.rows.filter(
    (r) => r.role === "parent" && r.liveKey != null && r.canPublish === false,
  );
}

function formatRemainingExecutableMarkdown(report: CatalogCoverageReport): string[] {
  const remaining = remainingExecutableParents(report);
  if (remaining.length === 0) {
    return [
      "## Remaining executable (live key, not wired)",
      "",
      `None. All ${report.counts.executable} live-key parents have a fixture overlay. Do not invent PN1/PN2 monthly-summary keys. Do not invent umbrella REQ-8.6 / REQ-11.7 / REQ-30.7 / REQ-11.3 / REQ-20.3 / REQ-21.3.`,
    ];
  }
  const lines = [
    "## Remaining executable (live key, not wired)",
    "",
    `${remaining.length} imported parents have a live company_obligations key but no fixture overlay yet. Do not invent PN1/PN2 monthly-summary keys. Do not invent umbrella REQ-8.6 / REQ-11.7 / REQ-30.7 / REQ-11.3 / REQ-20.3 / REQ-21.3.`,
    "",
    "| Key | Live key | Status |",
    "| --- | --- | --- |",
  ];
  for (const row of remaining) {
    lines.push(`| ${row.requirementKey} | ${row.liveKey} | ${row.implementationStatus} |`);
  }
  return lines;
}

function formatControlledPublicationMarkdown(report: CatalogCoverageReport): string[] {
  return [
    "## Controlled publication (Soft=none)",
    "",
    `Wiring is not publication. \`VERIFIED_PUBLICATIONS\` has ${report.counts.published} published / ${report.counts.verified} verified rows. Unresolved stay draft with reasons. One rule or a named READY batch is pasted into \`src/lib/obligations/draft-rules/verified-publication.ts\` after \`npm run propose:verified-publication\`. No global flip. No Soft table. See \`docs/compliance/dhhs91172/CONTROLLED_PUBLISH.md\`.`,
  ];
}

function draftUnwiredBlockerCategory(blockers: string[]): string {
  const text = blockers.join(" | ");
  if (/No live company_obligations key/i.test(text) && /no applicability predicates/i.test(text)) {
    return "no_live_key + no_predicates";
  }
  if (/No live company_obligations key/i.test(text)) return "no_live_key";
  if (/Release_Gaps/i.test(text)) return "release_gaps";
  if (/publication_gap/i.test(text)) return "publication_gap";
  if (/no applicability predicates/i.test(text)) return "no_predicates_only";
  if (/Unanswered applicability fact/i.test(text)) return "unanswered_facts";
  return "other";
}

function formatDraftUnwiredBlockerMarkdown(report: CatalogCoverageReport): string[] {
  const unwired = report.rows.filter(
    (r) => r.role === "parent" && r.implementationStatus === "draft_unwired",
  );
  const cats = new Map<string, number>();
  for (const row of unwired) {
    const cat = draftUnwiredBlockerCategory(row.blockers);
    cats.set(cat, (cats.get(cat) ?? 0) + 1);
  }
  const lines = [
    "## Draft-unwired blocker categories",
    "",
    `${unwired.length} draft-unwired parents. Categories only — not a row novel.`,
    "",
    "| Category | Count |",
    "| --- | ---: |",
  ];
  for (const [cat, n] of [...cats.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${cat} | ${n} |`);
  }
  const system = report.rows.filter(
    (r) => r.role === "parent" && r.implementationStatus === "system_behavior",
  ).length;
  lines.push("");
  lines.push(
    `${system} additional parents are system_behavior (creates_user_task=no / SYSTEM handling) — not draft-unwired and not a live clock.`,
  );
  return lines;
}

export function formatCatalogCoverageMarkdown(report: CatalogCoverageReport): string {
  const c = report.counts;
  const lines = [
    "# DHHS91172 catalog coverage",
    "",
    `Workbook sha256 \`${report.workbookSha256}\`.`,
    "",
    "Parents connect to the existing live obligation engine. Child elements are checklist fields of the parent and do not mint staff tasks. Missing applicability facts stay questions — never silent N/A. Unrelated Release_Gaps do not block a verified rule.",
    "",
    "## Counts",
    "",
    `| Measure | Count |`,
    `| --- | ---: |`,
    `| Imported parents | ${c.importedParents} |`,
    `| Imported elements | ${c.importedElements} |`,
    `| Imported rows | ${c.importedRows} |`,
    `| Executable (live key mapped) | ${c.executable} |`,
    `| Verified / activatable | ${c.verified} |`,
    `| Published | ${c.published} |`,
    `| Blocked (rule-specific gap, no live key) | ${c.blocked} |`,
    `| Live mapped (clock) | ${c.liveMapped} |`,
    `| System / standing behavior | ${c.systemBehavior} |`,
    `| Draft unwired | ${c.draftUnwired} |`,
    `| Element of parent | ${c.elementOfParent} |`,
    `| Wired first batch (fixture overlay) | ${c.wiredFirstBatch} |`,
    `| Wired second batch (fixture overlay) | ${c.wiredSecondBatch} |`,
    `| Wired third batch (fixture overlay) | ${c.wiredThirdBatch} |`,
    `| Wired fourth batch (fixture overlay) | ${c.wiredFourthBatch} |`,
    `| Wired fifth batch (fixture overlay) | ${c.wiredFifthBatch} |`,
    `| Wired sixth batch (fixture overlay) | ${c.wiredSixthBatch} |`,
    `| Wired seventh batch / Mega A (fixture overlay) | ${c.wiredSeventhBatch} |`,
    `| Wired eighth batch / Mega B (fixture overlay) | ${c.wiredEighthBatch} |`,
    `| Wired Mega C person-file / site leftovers (fixture overlay) | ${c.wiredMegaC} |`,
    `| Wired ninth batch / UPI-USTEPS ops (fixture overlay) | ${c.wiredNinthBatch} |`,
    `| Wired tenth batch / BC FBA-BSP twins (fixture overlay) | ${c.wiredTenthBatch} |`,
    `| Wired eleventh batch / FY Google Form annual twins (fixture overlay) | ${c.wiredEleventhBatch} |`,
    `| Wired twelfth batch / SEI-SJD UPI employment leftovers (fixture overlay) | ${c.wiredTwelfthBatch} |`,
    `| Wired thirteenth batch / OL Day Treatment Day Support twins (fixture overlay) | ${c.wiredThirteenthBatch} |`,
    `| Wired fourteenth batch / quarterly evac drill leftovers (fixture overlay) | ${c.wiredFourteenthBatch} |`,
    `| Wired fifteenth batch / Article 1 standing leftover children (fixture overlay) | ${c.wiredFifteenthBatch} |`,
    `| Wired sixteenth batch / remaining pack-key-ready leftovers (fixture overlay) | ${c.wiredSixteenthBatch} |`,
    `| Wired shared-behavior batches (fixture overlay) | ${c.wired} |`,
    `| Remaining executable (live key, not yet wired) | ${c.remainingExecutable} |`,
    "",
    ...formatControlledPublicationMarkdown(report),
    "",
    ...formatRemainingExecutableMarkdown(report),
    "",
    ...formatDraftUnwiredBlockerMarkdown(report),
    "",
    "## Parents",
    "",
    "| Key | Source | Owner | Completion | Timing | Live key | Status | Blocker |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of report.rows.filter((r) => r.role === "parent")) {
    const blocker = row.blockers[0]?.replace(/\|/g, "/") ?? "";
    lines.push(
      `| ${row.requirementKey} | ${row.sourceClauseId || row.sectionRef} | ${row.owner} | ${row.completionMethod.replace(/\|/g, "/")} | ${row.timing.replace(/\|/g, "/")} | ${row.liveKey ?? ""} | ${row.implementationStatus} | ${blocker} |`,
    );
  }
  lines.push("", "## Elements (no staff task)", "");
  lines.push(
    `${c.importedElements} child elements attach to a parent requirement. They are not listed individually here to avoid a duplicate task register.`,
  );
  lines.push("");
  return `${lines.join("\n")}\n`;
}
