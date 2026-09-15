/**
 * Stage 5: load the Dane-finalized DHHS91172 catalog as draft simulation data.
 * Every mapped row starts rule_status=draft / execution_status=not_published.
 * Source_index is archive metadata. Publication is per verified rule.
 * Missing legal facts stay missing-information — never invented.
 */

import { linkWorkbookSource, WORKBOOK_SOURCE_INDEX } from "./source.ts";
import type {
  CompletionRoute,
  DraftPredicate,
  DraftRule,
  DraftRuleTest,
  GroupLogic,
  PredicateKind,
  TimingAnchor,
} from "./types.ts";

export const CATALOG_BATCH_IDS = [
  "00",
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
] as const;

export type CatalogBatchId = (typeof CATALOG_BATCH_IDS)[number];

export type CatalogManifest = {
  sha256: string;
  dane_declared: string;
  workbook_says: string;
  source_index: string;
  requirements_rows: number;
  catalog_rows: number;
  release_gaps_open: number;
};

export type CatalogSheetRow = {
  requirement_key?: string;
  requirement_role?: string;
  source_clause_id?: string;
  requirement_name?: string;
  clause_text?: string;
  handling_label?: string;
  required_evidence?: string;
  completion_group_logic?: string;
  exceptions_alternatives?: string;
  renewal_rule?: string;
  fact_ids?: string;
  element_count?: number | string;
  /** Complete original workbook row; narrative is never silently compiled into law. */
  [key: string]: unknown;
  id?: string;
  requirement_id?: string;
  parent_id?: string | null;
  row_kind?: "parent" | "element" | string;
  title?: string;
  clause_id?: string;
  clause_ids?: string[];
  group_logic?: string;
  parent_assignment?: string;
  member_count?: number;
  timing_kind?: string;
  timing_days?: number;
  timing_start_year?: number;
  timing_cert_key?: string;
  timing_reason?: string;
  timing_note?: string;
  publication_gap?: string | null;
  release_gaps?: string[];
  source_index?: string;
  rule_status?: string;
  execution_status?: string;
  catalog_keys?: string[];
  predicates?: Array<{
    kind?: string;
    catalogKey?: string | null;
    serviceCodes?: string[];
  }>;
  tests?: Array<{ kind?: string; assert?: string }>;
  members?: Array<{
    id?: string;
    label?: string;
    sourceClauseId?: string;
    catalogKey?: string | null;
    completionRoutes?: string[];
  }>;
};

export type CatalogBatchFile = {
  batch?: string;
  ingest_status?: string;
  rows?: CatalogSheetRow[];
};

export type CatalogSheetFile = {
  sheet?: string;
  rows?: CatalogSheetRow[];
  ingest_status?: string;
  expected_parent_count?: number;
  expected_row_count?: number;
  open_count?: number;
};

export type ReleaseGapRow = {
  id: string;
  topic: string;
  clause: string | null;
  gap: string;
};

export type LoadedDraftRule = DraftRule & {
  workbookRow: CatalogSheetRow;
  applicabilityFacts: CatalogFact[];
  rule_status: "draft";
  execution_status: "not_published";
};

export type CatalogFact = { fact_id: string; question: string; [key: string]: unknown };

export type CatalogIngestStatus = "awaiting_batches" | "loaded";

export type LoadedCatalog = {
  manifest: CatalogManifest;
  ingestStatus: CatalogIngestStatus;
  parents: LoadedDraftRule[];
  elements: CatalogSheetRow[];
  requirementRows: CatalogSheetRow[];
  releaseGaps: ReleaseGapRow[];
  coreRuleLogic: LoadedDraftRule[];
};

export type CatalogLoadSummary = {
  workbookSha256: string;
  daneDeclared: string;
  expectedParentCount: number;
  expectedRequirementsCount: number;
  releaseGapsOpen: number;
  loadedParentCount: number;
  loadedRequirementCount: number;
  loadedElementCount: number;
  ingestStatus: CatalogIngestStatus;
  ruleStatus: "draft" | "mixed";
  executionStatus: "not_published" | "mixed";
  /** True only when at least one individually verified rule can activate. */
  canActivateAny: boolean;
  importedParentCount: number;
  importedElementCount: number;
  publishedCount: number;
  sourceIndex: "ARCHIVE METADATA";
};

const PREDICATE_KIND_SET = new Set<string>([
  "direct_support_assignment",
  "abi_caseload",
  "sei_assignment",
  "org_acre_coverage",
  "staff_acre_supervisor",
  "behavior_risk_assignment",
  "designated_benefits_staff",
  "usor_sei_vendor",
  "cmp_cms_assignment",
  "sjd_assignment",
  "periodic_report",
  "service_documentation",
  "payroll_timesheet",
  "evv_mandated",
  "signature_attestation",
  "billing_restriction",
  "pba_assignment",
  "universal_staff",
  "contractor_standing_file",
  "person_file_intake",
  "awarded_service_codes",
  "support_strategies_assignment",
  "product_default_reminder",
  "change_impact",
  "audit_export",
]);

function rowId(row: CatalogSheetRow): string {
  if (row.requirement_role === "element") return row.clause_id ?? "";
  return (row.requirement_key ?? row.id ?? row.requirement_id ?? "").trim();
}

export function isCatalogParentRow(row: CatalogSheetRow): boolean {
  if (row.requirement_role === "element") return false;
  if (row.requirement_role === "requirement") return true;
  if (row.row_kind === "element") return false;
  if (row.row_kind === "parent") return true;
  if (row.parent_id && String(row.parent_id).trim().length > 0) return false;
  return rowId(row).length > 0;
}

function clauseIdsFor(row: CatalogSheetRow): string[] {
  if (row.source_clause_id?.trim()) return [row.source_clause_id.trim()];
  if (Array.isArray(row.clause_ids) && row.clause_ids.length > 0) {
    return row.clause_ids.filter((c) => typeof c === "string" && c.trim().length > 0);
  }
  if (typeof row.clause_id === "string" && row.clause_id.trim().length > 0) {
    return [row.clause_id.trim()];
  }
  return [];
}

function mapTiming(row: CatalogSheetRow): TimingAnchor {
  const missing =
    row.timing_reason?.trim() ||
    row.timing_note?.trim() ||
    "Timing is missing-information. Do not invent an interval or annual-from-completion.";
  if (row.timing_kind === "hire_plus_days" && Number.isFinite(row.timing_days)) {
    return { kind: "hire_plus_days", days: row.timing_days as number };
  }
  if (row.timing_kind === "employment_year") {
    if (typeof row.timing_start_year === "number" && row.timing_start_year >= 1) {
      return { kind: "employment_year", startYear: row.timing_start_year };
    }
    return {
      kind: "none",
      reason: "Employment-year start is missing-information. Do not invent annual-from-completion.",
    };
  }
  if (
    row.timing_kind === "certificate_expiry" &&
    typeof row.timing_cert_key === "string" &&
    row.timing_cert_key.trim().length > 0
  ) {
    return { kind: "certificate_expiry", certKey: row.timing_cert_key.trim() };
  }
  if (row.timing_kind === "none") {
    return { kind: "none", reason: missing };
  }
  if (!row.timing_kind) {
    return { kind: "none", reason: missing };
  }
  return {
    kind: "none",
    reason: `Unknown timing kind ${row.timing_kind} is missing-information. Do not invent an interval.`,
  };
}

function mapGroupLogic(value: string | undefined): GroupLogic {
  if (value === "ANY" || value === "CONDITIONAL" || value === "ALL") return value;
  return "ALL";
}

function mapPredicates(row: CatalogSheetRow): DraftPredicate[] {
  if (!Array.isArray(row.predicates)) return [];
  const out: DraftPredicate[] = [];
  for (const pred of row.predicates) {
    if (!pred?.kind || !PREDICATE_KIND_SET.has(pred.kind)) continue;
    out.push({
      kind: pred.kind as PredicateKind,
      catalogKey: pred.catalogKey ?? null,
      ...(pred.serviceCodes && pred.serviceCodes.length > 0
        ? { serviceCodes: pred.serviceCodes }
        : {}),
    });
  }
  return out;
}

function mapTests(row: CatalogSheetRow): DraftRuleTest[] {
  if (!Array.isArray(row.tests)) return [];
  return row.tests
    .filter((t) => t?.kind && t.assert && t.assert.trim().length > 0)
    .map((t, i) => ({
      id: `${rowId(row)}-t${i + 1}`,
      kind: t.kind as DraftRuleTest["kind"],
      assert: t.assert!.trim(),
    }));
}

function defaultRoutes(): CompletionRoute[] {
  return ["SYSTEM"];
}

function resolveReleaseGaps(row: CatalogSheetRow, gapIndex: Map<string, ReleaseGapRow>): string[] {
  const ids = Array.isArray(row.release_gaps) ? row.release_gaps : [];
  const resolved = ids.map((id) => gapIndex.get(id)?.gap ?? id).filter((g) => g.trim().length > 0);
  return [...new Set(resolved)];
}

function mapMembers(
  row: CatalogSheetRow,
  childElements: CatalogSheetRow[],
): DraftRule["group"]["members"] {
  if (Array.isArray(row.members) && row.members.length > 0) {
    return row.members.map((m, i) => ({
      id: m.id?.trim() || `member-${i + 1}`,
      label: m.label?.trim() || row.title || rowId(row),
      sourceClauseId: m.sourceClauseId?.trim() || clauseIdsFor(row)[0] || rowId(row),
      catalogKey: m.catalogKey ?? null,
      completionRoutes:
        (m.completionRoutes?.filter(Boolean) as CompletionRoute[]) ?? defaultRoutes(),
    }));
  }
  if (childElements.length > 0) {
    return childElements.map((el, i) => ({
      id: rowId(el) || `element-${i + 1}`,
      label: el.clause_text?.trim() || el.title?.trim() || rowId(el),
      sourceClauseId: clauseIdsFor(el)[0] || clauseIdsFor(row)[0] || rowId(el),
      catalogKey: null,
      completionRoutes: defaultRoutes(),
    }));
  }
  return [];
}

/**
 * Map workbook / batch rows into draft rule records.
 * Forces draft / not_published regardless of source_index or row status flags.
 */
export function mapCatalogRowsToDraftRules(
  rows: readonly CatalogSheetRow[],
  releaseGaps: readonly ReleaseGapRow[] = [],
): LoadedDraftRule[] {
  const gapIndex = new Map(releaseGaps.map((g) => [g.id, g]));
  const parents = rows.filter(isCatalogParentRow);
  const elements = rows.filter((r) => !isCatalogParentRow(r));

  return parents
    .map((row) => {
      const id = rowId(row);
      if (!id) return null;
      const clauses = clauseIdsFor(row);
      const children = elements.filter(
        (el) => String(el.parent_id ?? el.requirement_key ?? "").trim() === id,
      );
      const route = ["IN_PLATFORM", "UPLOAD", "EXTERNAL", "SYSTEM"].includes(
        row.handling_label ?? "",
      )
        ? (row.handling_label as CompletionRoute)
        : null;
      const publicationGap =
        typeof row.publication_gap === "string" && row.publication_gap.trim().length > 0
          ? row.publication_gap.trim()
          : null;
      const mapped: LoadedDraftRule = {
        workbookRow: { ...row },
        applicabilityFacts: [],
        id,
        version: 1,
        title: row.requirement_name?.trim() || row.title?.trim() || id,
        catalogKeys: Array.isArray(row.catalog_keys) ? row.catalog_keys : [],
        lifecycle: "draft",
        publication: "not_published",
        rule_status: "draft",
        execution_status: "not_published",
        source: linkWorkbookSource(clauses.length > 0 ? clauses : [id]),
        sourceIndex: WORKBOOK_SOURCE_INDEX,
        predicates: mapPredicates(row),
        group: {
          logic: mapGroupLogic(row.group_logic),
          parentAssignment: row.parent_assignment === "per_member" ? "per_member" : "one",
          members: mapMembers(row, children),
        },
        timing: mapTiming(row),
        evidence: {
          summary: row.required_evidence ?? "",
          routes: route ? [route] : [],
          defaultHandlingLabel: row.handling_label ?? "",
          automaticEquivalency: false,
        },
        completionRoutes: route ? [route] : defaultRoutes(),
        tests: mapTests(row),
        unresolvedAlternatives:
          row.requirement_key && !row.group_logic
            ? [
                row.exceptions_alternatives ||
                  row.completion_group_logic ||
                  "Explicit completion logic requires review",
              ]
            : [],
        unresolvedRenewals:
          row.renewal_rule && row.renewal_rule !== "None" ? [row.renewal_rule] : [],
        releaseGaps: resolveReleaseGaps(row, gapIndex),
        publicationGap,
        approval: null,
      };
      return mapped;
    })
    .filter((rule): rule is LoadedDraftRule => rule !== null);
}

export function rowsFromUnknown(value: unknown): CatalogSheetRow[] {
  if (Array.isArray(value)) return value as CatalogSheetRow[];
  if (value && typeof value === "object" && "rows" in value) {
    const rows = (value as { rows?: unknown }).rows;
    return Array.isArray(rows) ? (rows as CatalogSheetRow[]) : [];
  }
  return [];
}

export function assembleCatalogRows(
  batches: readonly unknown[],
  fallback?: unknown,
): CatalogSheetRow[] {
  const fromBatches = batches.flatMap((batch) => rowsFromUnknown(batch));
  const rows = fromBatches.length > 0 ? fromBatches : rowsFromUnknown(fallback);
  const seen = new Set<string>();
  for (const row of rows) {
    const id = rowId(row);
    if (!id || id === "requirement_key")
      throw new Error("Invalid catalog row: missing ID or spreadsheet header");
    if (seen.has(id)) throw new Error(`Duplicate catalog ID: ${id}`);
    seen.add(id);
  }
  return rows;
}

export function catalogIngestStatus(parentCount: number, expected: number): CatalogIngestStatus {
  return parentCount > 0 && parentCount === expected ? "loaded" : "awaiting_batches";
}

export function catalogLoadSummary(loaded: LoadedCatalog): CatalogLoadSummary {
  const published = loaded.parents.filter((r) => r.publication === "published");
  const mixed = published.length > 0 && published.length < loaded.parents.length;
  return {
    workbookSha256: loaded.manifest.sha256,
    daneDeclared: loaded.manifest.dane_declared,
    expectedParentCount: loaded.manifest.catalog_rows,
    expectedRequirementsCount: loaded.manifest.requirements_rows,
    releaseGapsOpen: loaded.manifest.release_gaps_open,
    loadedParentCount: loaded.parents.length,
    loadedRequirementCount: loaded.requirementRows.length,
    loadedElementCount: loaded.elements.length,
    ingestStatus: loaded.ingestStatus,
    ruleStatus: mixed ? "mixed" : published.length > 0 ? "mixed" : "draft",
    executionStatus: mixed || published.length > 0 ? "mixed" : "not_published",
    canActivateAny: false,
    importedParentCount: loaded.parents.length,
    importedElementCount: loaded.elements.length,
    publishedCount: published.length,
    sourceIndex: "ARCHIVE METADATA",
  };
}

export function buildLoadedCatalog(input: {
  manifest: CatalogManifest;
  batchFiles?: readonly unknown[];
  requirementCatalog?: unknown;
  requirements?: unknown;
  releaseGaps?: readonly ReleaseGapRow[];
  coreRuleLogic?: unknown;
  applicabilityFacts?: { rows?: CatalogFact[] };
}): LoadedCatalog {
  const assembled = assembleCatalogRows(input.batchFiles ?? [], input.requirementCatalog);
  const releaseGaps = input.releaseGaps ?? [];
  const requirementRows = rowsFromUnknown(input.requirements);
  const elements =
    requirementRows.length > 0
      ? requirementRows.filter((r) => !isCatalogParentRow(r))
      : assembled.filter((r) => !isCatalogParentRow(r));
  const parentRows = assembled.filter(isCatalogParentRow);
  const ids = new Set(parentRows.map(rowId));
  if (requirementRows.length > 0) {
    const canonicalIds = new Set(requirementRows.filter(isCatalogParentRow).map(rowId));
    if (ids.size !== canonicalIds.size || [...ids].some((id) => !canonicalIds.has(id))) {
      throw new Error("Catalog parents do not match canonical Requirements");
    }
    const clauseIds = requirementRows.map((row) => row.clause_id).filter(Boolean);
    if (new Set(clauseIds).size !== clauseIds.length)
      throw new Error("Duplicate requirement source clause ID");
    for (const parent of parentRows) {
      const children = elements.filter((row) => row.requirement_key === rowId(parent));
      if (parent.element_count !== undefined && children.length !== Number(parent.element_count)) {
        throw new Error(`Element count mismatch on ${rowId(parent)}`);
      }
    }
  }
  for (const element of elements) {
    const parentId = String(element.parent_id ?? element.requirement_key ?? "");
    if (!ids.has(parentId))
      throw new Error(`Orphan element: ${rowId(element)} references ${parentId}`);
  }
  const parents = mapCatalogRowsToDraftRules([...parentRows, ...elements], releaseGaps);
  if (input.applicabilityFacts) {
    const facts = new Map((input.applicabilityFacts.rows ?? []).map((f) => [f.fact_id, f]));
    if (facts.size !== (input.applicabilityFacts.rows ?? []).length)
      throw new Error("Duplicate fact ID");
    for (const parent of parents) {
      const refs = (parent.workbookRow.fact_ids ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      parent.applicabilityFacts = refs.map((id) => {
        const fact = facts.get(id);
        if (!fact) throw new Error(`Unknown fact ${id} on ${parent.id}`);
        return fact;
      });
    }
  }
  const coreRows = rowsFromUnknown(input.coreRuleLogic);
  const coreRuleLogic = mapCatalogRowsToDraftRules(coreRows, releaseGaps);
  const ingestStatus =
    requirementRows.length === input.manifest.requirements_rows
      ? catalogIngestStatus(parents.length, input.manifest.catalog_rows)
      : "awaiting_batches";
  return {
    manifest: input.manifest,
    ingestStatus,
    parents,
    elements,
    requirementRows,
    releaseGaps: [...releaseGaps],
    coreRuleLogic,
  };
}
