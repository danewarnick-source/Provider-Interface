import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  COMPLIANCE_STORE_TABLES,
  TRANSPORT_OPT_OUT_FACT_KEY,
  writeAttestation,
  writeFileRecord,
  writeObligationAssignee,
  writeObligationInstance,
  writeOrgFact,
  writeRequirementApplicability,
  writeRequirementDef,
  writeReview,
  writeTrainingRun,
} from "./compliance-store.ts";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("compliance store phase 1 stubs", () => {
  it("lists the nine core tables and does not write", () => {
    assert.deepEqual([...COMPLIANCE_STORE_TABLES], [
      "requirement_defs",
      "org_facts",
      "file_records",
      "obligation_instances",
      "obligation_instance_assignees",
      "attestations",
      "training_runs",
      "reviews",
      "requirement_applicability",
    ]);
    assert.equal(TRANSPORT_OPT_OUT_FACT_KEY, "does_not_transport");

    const orgId = "00000000-0000-0000-0000-000000000001";
    const results = [
      writeRequirementDef({
        organizationId: orgId,
        requirementKey: "background_screening_annual",
        subjectKind: "staff",
        layer: "all_staff_clock",
      }),
      writeOrgFact({
        organizationId: orgId,
        subjectKind: "staff",
        subjectId: "00000000-0000-0000-0000-000000000002",
        factKey: TRANSPORT_OPT_OUT_FACT_KEY,
        factValue: true,
      }),
      writeObligationInstance({
        organizationId: orgId,
        requirementKey: "background_screening_annual",
        subjectKind: "staff",
        subjectId: "00000000-0000-0000-0000-000000000002",
        status: "missing",
      }),
      writeObligationAssignee({
        organizationId: orgId,
        instanceId: "00000000-0000-0000-0000-000000000003",
        staffId: "00000000-0000-0000-0000-000000000002",
      }),
      writeFileRecord({
        organizationId: orgId,
        subjectKind: "staff",
        storagePath: `${orgId}/example.pdf`,
      }),
      writeAttestation({
        organizationId: orgId,
        subjectKind: "staff",
        attestedBy: "00000000-0000-0000-0000-000000000002",
      }),
      writeTrainingRun({
        organizationId: orgId,
        subjectId: "00000000-0000-0000-0000-000000000002",
      }),
      writeReview({
        organizationId: orgId,
        subjectKind: "org",
        reviewKind: "nectar_advisory",
      }),
      writeRequirementApplicability({
        organizationId: orgId,
        requirementKey: "driving_record_transport",
        subjectKind: "staff",
        subjectId: "00000000-0000-0000-0000-000000000002",
        applies: true,
      }),
    ];
    for (const result of results) {
      assert.equal(result.written, false);
      assert.match(result.reason, /phase1_stub/);
    }
  });

  it("stubs are not imported by live obligation or training writers", () => {
    const live = [
      "./company-obligations.functions.ts",
      "./in-hive-training.functions.ts",
      "./hr-training-hours.functions.ts",
      "./compliance-spine.ts",
    ];
    for (const file of live) {
      const src = read(file);
      assert.doesNotMatch(src, /compliance-store/);
    }
  });

  it("migration is additive and names the core tables", () => {
    const sql = readFileSync(
      new URL(
        "../../supabase/migrations/20260916120000_compliance_training_core_tables.sql",
        import.meta.url,
      ),
      "utf8",
    );
    assert.doesNotMatch(sql, /DROP TABLE/);
    assert.doesNotMatch(sql, /DROP COLUMN/);
    for (const table of COMPLIANCE_STORE_TABLES) {
      assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
      assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
      assert.match(sql, /is_org_member\(organization_id, auth\.uid\(\)\)/);
    }
    assert.match(sql, /missing.*due.*complete.*waived/s);
    assert.match(sql, /does_not_transport/);
    assert.match(sql, /staff_shelf/);
    assert.match(sql, /staff_exception/);
  });

  it("cutlist exists and uses the four dispositions", () => {
    const cutlist = readFileSync(
      new URL("../../docs/compliance-training-consolidation-cutlist.md", import.meta.url),
      "utf8",
    );
    assert.match(cutlist, /company_obligations/);
    assert.match(cutlist, /nectar_requirements/);
    assert.match(cutlist, /hive_training_assignments/);
    assert.match(cutlist, /pack_changelog/);
    assert.match(cutlist, /training_completions/);
    assert.match(cutlist, /state_requirement_sources/);
    assert.match(cutlist, /MERGE_INTO:obligation_instances/);
    assert.match(cutlist, /MERGE_INTO:requirement_defs/);
    assert.match(cutlist, /\bKEEP\b/);
    assert.match(cutlist, /\bFREEZE\b/);
    assert.match(cutlist, /\bDROP_LATER\b/);
    assert.match(cutlist, /DEFAULT ON/);
    assert.doesNotMatch(cutlist, /DROP TABLE/);
  });
});
