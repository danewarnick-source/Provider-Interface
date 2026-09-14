import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assembleCatalogRows,
  buildLoadedCatalog,
  catalogLoadSummary,
  isCatalogParentRow,
  mapCatalogRowsToDraftRules,
  rowsFromUnknown,
  type CatalogManifest,
  type CatalogSheetRow,
  type ReleaseGapRow,
} from "./catalog-loader.ts";
import {
  readApplicabilityFacts,
  readCommittedCatalog,
  readCommittedManifest,
  readInstructions,
  readTinyCatalogFixture,
} from "./catalog-fs.ts";
import { CORE_RULE_LOGIC_SLICE, REQ_1_8_4_ORIENTATION } from "./fixtures.ts";
import { canActivate, canPublish, structuralPublicationGaps } from "./publication.ts";
import {
  sourceIndexGrantsPublication,
  WORKBOOK_CATALOG_PARENT_COUNT,
  WORKBOOK_DESIGN_REVISION,
  WORKBOOK_RELEASE_GAPS_OPEN,
  WORKBOOK_REQUIREMENTS_ROW_COUNT,
  WORKBOOK_SHA256,
  WORKBOOK_SOURCE_INDEX,
} from "./source.ts";

const TINY_MANIFEST: CatalogManifest = {
  sha256: WORKBOOK_SHA256,
  dane_declared: "completed_and_finalized_sow_mapping_2026-09-11",
  workbook_says:
    "operational rules DRAFT not published; publish only with reviewed predicates/timing/evidence/tests",
  source_index: "archive metadata not publication permission",
  requirements_rows: 1367,
  catalog_rows: 760,
  release_gaps_open: 12,
};

function tinyRows(): CatalogSheetRow[] {
  return rowsFromUnknown(readTinyCatalogFixture());
}

describe("committed DHHS91172 catalog files", () => {
  it("checks in Dane's finalized MANIFEST verbatim", () => {
    const manifest = readCommittedManifest();
    assert.equal(manifest.sha256, WORKBOOK_SHA256);
    assert.equal(manifest.dane_declared, "completed_and_finalized_sow_mapping_2026-09-11");
    assert.match(manifest.workbook_says, /DRAFT not published/i);
    assert.match(manifest.source_index, /archive metadata/i);
    assert.equal(manifest.catalog_rows, 760);
    assert.equal(manifest.requirements_rows, 1367);
    assert.equal(manifest.release_gaps_open, 12);
    assert.equal(WORKBOOK_CATALOG_PARENT_COUNT, 760);
    assert.equal(WORKBOOK_REQUIREMENTS_ROW_COUNT, 1367);
    assert.equal(WORKBOOK_RELEASE_GAPS_OPEN, 12);
    assert.equal(WORKBOOK_DESIGN_REVISION, "2026-09-12");
  });

  it("loads the complete committed catalog; empty or partial imports cannot pass", () => {
    const loaded = readCommittedCatalog();
    assert.equal(loaded.manifest.catalog_rows, 760);
    assert.equal(loaded.releaseGaps.length, 12);
    const summary = catalogLoadSummary(loaded);
    assert.equal(summary.expectedParentCount, 760);
    assert.equal(summary.ruleStatus, "draft");
    assert.equal(summary.executionStatus, "not_published");
    assert.equal(summary.canActivate, false);
    assert.equal(summary.sourceIndex, "ARCHIVE METADATA");
    assert.equal(loaded.ingestStatus, "loaded");
    assert.equal(loaded.parents.length, 760);
    assert.equal(loaded.requirementRows.length, 1367);
    assert.equal(loaded.elements.length, 607);
    assert.equal(new Set(loaded.parents.map((r) => r.id)).size, 760);
    assert.equal(
      loaded.parents.some((r) => r.id === "requirement_key"),
      false,
    );
    for (const rule of loaded.parents) {
      assert.equal(rule.group.members.length, Number(rule.workbookRow.element_count), rule.id);
      assert.equal(rule.title, rule.workbookRow.requirement_name, rule.id);
      assert.deepEqual(rule.source.clauseIds, [rule.workbookRow.source_clause_id], rule.id);
      assert.ok(rule.workbookRow.clause_text, rule.id);
      assert.equal(rule.evidence.summary, rule.workbookRow.required_evidence, rule.id);
      assert.equal(rule.lifecycle, "draft");
      assert.equal(rule.publication, "not_published");
      assert.equal(canActivate(rule), false);
      const ids = (rule.workbookRow.fact_ids ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      assert.deepEqual(
        rule.applicabilityFacts.map((f) => f.fact_id),
        ids,
        rule.id,
      );
    }
  });

  it("preserves exact orientation topics and renewal instructions without compiling guesses", () => {
    const loaded = readCommittedCatalog();
    const orientation = loaded.parents.find((r) => r.id === "REQ-1.8.4")!;
    assert.equal(orientation.group.members.length, 25);
    assert.match(orientation.workbookRow.deadline as string, /Earlier of/);
    assert.match(orientation.group.members[0].label, /911/);
    const sei = loaded.parents.find((r) => r.id === "REQ-30.6.c")!;
    assert.match(sei.workbookRow.exceptions_alternatives!, /ANY one route/);
    assert.ok(sei.unresolvedAlternatives.length > 0);
    assert.equal(canPublish(sei), false);
    const annual = loaded.parents.find((r) => r.id === "REQ-1.8.7")!;
    assert.match(annual.workbookRow.renewal_rule!, /employment-year/);
  });

  it("retains workbook release gaps rather than unrelated pilot gaps", () => {
    const gaps = readCommittedCatalog().releaseGaps;
    assert.ok(gaps.some((g) => g.clause === "3.4(1)(H)" && g.topic.includes("three")));
    assert.ok(gaps.some((g) => g.clause === "24.3(2), 25.3(2)" && g.topic.includes("RP4/RP5")));
    assert.ok(gaps.some((g) => g.clause === "HIPAA / external services"));
  });

  it("keeps every committed Core_Rule_Logic extract row draft / not_published", () => {
    const loaded = readCommittedCatalog();
    assert.equal(loaded.coreRuleLogic.length, CORE_RULE_LOGIC_SLICE.length);
    for (const rule of loaded.coreRuleLogic) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.equal(rule.rule_status, "draft", rule.id);
      assert.equal(rule.execution_status, "not_published", rule.id);
      assert.equal(rule.approval, null, rule.id);
      assert.equal(rule.sourceIndex.label, "ARCHIVE METADATA");
      assert.equal(rule.sourceIndex.isPublicationPermission, false);
      assert.equal(sourceIndexGrantsPublication(rule.sourceIndex), false);
      assert.equal(canActivate(rule), false, rule.id);
    }
  });

  it("holds Design_Review locks on the committed Core_Rule_Logic extract", () => {
    const loaded = readCommittedCatalog();
    const orientation = loaded.coreRuleLogic.find((r) => r.id === "REQ-1.8.4");
    assert.equal(orientation?.group.logic, "ALL");
    assert.equal(orientation?.group.parentAssignment, "one");
    const pct = loaded.coreRuleLogic.find((r) => r.id === "REQ-1.8.5");
    assert.ok(pct);
    assert.equal(pct.timing.kind === "none" || pct.group.logic === "ALL", true);
    const seiBoth = loaded.coreRuleLogic.find((r) => r.id === "REQ-30.6.b");
    const seiAny = loaded.coreRuleLogic.find((r) => r.id === "REQ-30.6.c");
    assert.equal(seiBoth?.group.logic, "ALL");
    assert.equal(seiAny?.group.logic, "ANY");
    const evv = loaded.coreRuleLogic.find((r) => r.id === "REQ-1.12");
    assert.ok(evv?.publicationGap);
    assert.equal(canPublish(evv), false);
  });

  it("does not treat Instructions Source_index as publication permission", () => {
    const instructions = readInstructions() as { publication?: { canActivate?: boolean } };
    assert.equal(instructions.publication?.canActivate, false);
    const facts = readApplicabilityFacts() as { unknown_policy?: string; never?: string };
    assert.equal(facts.unknown_policy, "question_or_missing_information");
    assert.equal(facts.never, "automatic_compliance");
    assert.equal(sourceIndexGrantsPublication(WORKBOOK_SOURCE_INDEX), false);
  });
});

describe("catalog loader tiny fixture", () => {
  it("rejects headers, duplicates, unresolved fact IDs and orphan elements", () => {
    assert.throws(
      () => assembleCatalogRows([{ rows: [{ requirement_key: "requirement_key" }] }]),
      /header/,
    );
    assert.throws(
      () =>
        assembleCatalogRows([
          { rows: [{ requirement_key: "REQ-1" }, { requirement_key: "REQ-1" }] },
        ]),
      /Duplicate/,
    );
    assert.throws(
      () =>
        buildLoadedCatalog({
          manifest: TINY_MANIFEST,
          batchFiles: [{ rows: [{ requirement_key: "REQ-1", fact_ids: "FACT-MISSING" }] }],
          applicabilityFacts: { rows: [] },
        }),
      /Unknown fact/,
    );
    assert.throws(
      () =>
        buildLoadedCatalog({
          manifest: TINY_MANIFEST,
          requirements: {
            rows: [
              {
                requirement_key: "REQ-MISSING",
                requirement_role: "element",
                clause_id: "SOURCE-1",
              },
            ],
          },
        }),
      /Orphan/,
    );
  });
  it("maps parents, rolls elements, and forces draft / not_published", () => {
    const rows = tinyRows();
    assert.equal(rows.filter(isCatalogParentRow).length, 5);
    const releaseGaps: ReleaseGapRow[] = [
      {
        id: "RG-1.12-EVV",
        topic: "EVV",
        clause: "SOW §1.12",
        gap: "needs EVV mapping review — do not invent UEVV / state integration success",
      },
    ];
    const rules = mapCatalogRowsToDraftRules(rows, releaseGaps);
    assert.equal(rules.length, 5);
    for (const rule of rules) {
      assert.equal(rule.lifecycle, "draft", rule.id);
      assert.equal(rule.publication, "not_published", rule.id);
      assert.equal(rule.rule_status, "draft", rule.id);
      assert.equal(rule.execution_status, "not_published", rule.id);
      assert.equal(canActivate(rule), false, rule.id);
      assert.equal(rule.sourceIndex.label, "ARCHIVE METADATA");
      assert.equal(sourceIndexGrantsPublication(rule.sourceIndex), false);
    }
    const orientation = rules.find((r) => r.id === "REQ-1.8.4");
    assert.equal(orientation?.group.logic, "ALL");
    assert.equal(orientation?.group.parentAssignment, "one");
    assert.equal(orientation?.group.members.length, 1);
    assert.equal(orientation?.group.members[0]?.id, "REQ-1.8.4-A");
    assert.equal(orientation?.timing.kind, "hire_plus_days");
  });

  it("keeps orientation ALL and refuses invented annual-from-completion", () => {
    const rules = mapCatalogRowsToDraftRules(tinyRows());
    const orientation = rules.find((r) => r.id === "REQ-1.8.4");
    assert.equal(orientation?.group.logic, "ALL");
    assert.notEqual(orientation?.group.logic, "ANY");
    const pct = rules.find((r) => r.id === "REQ-1.8.5-PCT");
    assert.equal(pct?.timing.kind, "none");
    if (pct?.timing.kind === "none") {
      assert.match(pct.timing.reason, /Do not invent annual-from-completion/);
    }
    const invented = mapCatalogRowsToDraftRules([
      {
        id: "REQ-NO-ANNUAL",
        row_kind: "parent",
        title: "Missing interval",
        clause_ids: ["SOW §unknown"],
        timing_kind: "employment_year",
      },
    ]);
    assert.equal(invented[0]?.timing.kind, "none");
    if (invented[0]?.timing.kind === "none") {
      assert.match(invented[0].timing.reason, /Do not invent annual-from-completion/);
    }
  });

  it("keeps SEI BOTH coverage vs ANY training routes", () => {
    const rules = mapCatalogRowsToDraftRules(tinyRows());
    assert.equal(rules.find((r) => r.id === "REQ-30.6.b")?.group.logic, "ALL");
    assert.equal(rules.find((r) => r.id === "REQ-30.6.c")?.group.logic, "ANY");
  });

  it("ignores Source_index ACTIVE and published flags on the row", () => {
    const evv = mapCatalogRowsToDraftRules(tinyRows()).find((r) => r.id === "REQ-1.12");
    assert.ok(evv);
    assert.equal(evv.rule_status, "draft");
    assert.equal(evv.execution_status, "not_published");
    assert.equal(evv.sourceIndex.isPublicationPermission, false);
    assert.equal(sourceIndexGrantsPublication(evv.sourceIndex), false);
    assert.ok(evv.publicationGap);
    assert.equal(canPublish(evv), false);
    assert.ok(structuralPublicationGaps(evv).some((g) => g.key === "publication_gap"));
    assert.ok(structuralPublicationGaps(evv).some((g) => g.key === "release_gaps"));
  });

  it("canPublish fails when publication_gap is set even without other holes", () => {
    const complete = structuredClone(REQ_1_8_4_ORIENTATION);
    complete.publicationGap = "screening interval not published";
    assert.equal(canPublish(complete), false);
    assert.ok(structuralPublicationGaps(complete).some((g) => g.key === "publication_gap"));
    assert.equal(canActivate(complete), false);
  });

  it("assembles batch rows ahead of the empty Requirement_Catalog fallback", () => {
    const batches = [{ batch: "00", rows: tinyRows().filter(isCatalogParentRow) }];
    const assembled = assembleCatalogRows(batches, { rows: [] });
    assert.equal(assembled.length, 5);
    const loaded = buildLoadedCatalog({
      manifest: TINY_MANIFEST,
      batchFiles: batches,
      requirementCatalog: { rows: [] },
      requirements: { rows: [] },
      releaseGaps: [],
      coreRuleLogic: { rows: [] },
    });
    assert.equal(loaded.parents.length, 5);
    assert.equal(loaded.ingestStatus, "awaiting_batches");
  });
});
