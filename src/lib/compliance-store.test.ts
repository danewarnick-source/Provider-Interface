import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  COMPLIANCE_STORE_TABLES,
  TRANSPORT_OPT_OUT_FACT_KEY,
  bestEffortComplianceWrite,
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

function fakeSupabase(handler: (table: string, method: string) => { data?: unknown; error?: { message: string } }) {
  return {
    from(table: string) {
      const api = {
        select() {
          return api;
        },
        eq() {
          return api;
        },
        is() {
          return api;
        },
        maybeSingle: async () => handler(table, "select"),
        insert() {
          return {
            select() {
              return {
                maybeSingle: async () => handler(table, "insert"),
              };
            },
          };
        },
        update() {
          return {
            eq() {
              return {
                select() {
                  return {
                    maybeSingle: async () => handler(table, "update"),
                  };
                },
              };
            },
          };
        },
        upsert() {
          return {
            select() {
              return {
                maybeSingle: async () => handler(table, "upsert"),
              };
            },
          };
        },
      };
      return api;
    },
  };
}

describe("compliance store writers", () => {
  it("lists the nine core tables and the transport opt-out key", () => {
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
  });

  it("upserts obligation instances and swallows writer failures", async () => {
    const orgId = "00000000-0000-0000-0000-000000000001";
    const staffId = "00000000-0000-0000-0000-000000000002";
    const writes: string[] = [];
    const sb = fakeSupabase((table, method) => {
      writes.push(`${method}:${table}`);
      if (method === "select") return { data: null };
      return { data: { id: "00000000-0000-0000-0000-000000000099" } };
    });

    const instance = await writeObligationInstance(sb, {
      organizationId: orgId,
      requirementKey: "background_screening_annual",
      subjectKind: "staff",
      subjectId: staffId,
      status: "due",
    });
    assert.equal(instance.written, true);
    assert.ok(instance.id);

    const def = await writeRequirementDef(sb, {
      organizationId: null,
      requirementKey: "background_screening_annual",
      subjectKind: "staff",
      layer: "all_staff_clock",
    });
    assert.equal(def.written, true);

    const swallowed = await bestEffortComplianceWrite("boom", async () => {
      throw new Error("new store down");
    });
    assert.equal(swallowed.written, false);
    assert.match(swallowed.reason ?? "", /new store down/);

    await writeOrgFact(sb, {
      organizationId: orgId,
      subjectKind: "staff",
      subjectId: staffId,
      factKey: TRANSPORT_OPT_OUT_FACT_KEY,
      factValue: true,
    });
    await writeObligationAssignee(sb, {
      organizationId: orgId,
      instanceId: instance.id ?? "x",
      staffId,
    });
    await writeFileRecord(sb, {
      organizationId: orgId,
      subjectKind: "staff",
      storagePath: `${orgId}/example.pdf`,
    });
    await writeAttestation(sb, {
      organizationId: orgId,
      subjectKind: "staff",
      attestedBy: staffId,
    });
    await writeTrainingRun(sb, {
      organizationId: orgId,
      subjectId: staffId,
      requirementKey: "orientation_30_day",
    });
    await writeReview(sb, {
      organizationId: orgId,
      subjectKind: "org",
      reviewKind: "nectar_advisory",
    });
    await writeRequirementApplicability(sb, {
      organizationId: orgId,
      requirementKey: "driving_record_transport",
      subjectKind: "staff",
      subjectId: staffId,
      applies: true,
    });
    assert.ok(writes.some((w) => w.includes("obligation_instances")));
  });

  it("live locked-SOW writers import the dual-write helpers", () => {
    const live = [
      "./company-obligations.functions.ts",
      "./ensure-staff-obligation.ts",
      "./in-hive-training.functions.ts",
      "./in-hive-training-pct.functions.ts",
      "./client-specific-training.functions.ts",
      "./external-compliance.functions.ts",
      "./nectar-engine.functions.ts",
      "./authoritative-sources.functions.ts",
      "./obligations/applicability.ts",
      "./agency-setup-persist.ts",
    ];
    for (const file of live) {
      const src = read(file);
      assert.match(src, /compliance-store-dual-write/);
    }
    const punch = read("../components/evv/punch-pad.tsx");
    assert.doesNotMatch(punch, /compliance-store/);
  });

  it("core-table migration stays additive", () => {
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
    }
  });
});
