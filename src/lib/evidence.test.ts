import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  EVIDENCE_PACKS,
  EVIDENCE_REQUIREMENTS,
  chipsForRequirementKey,
  defaultQuestionnaireAnswers,
  hostHomeDualLinkPeerKey,
  isBuiltInTaxFormKey,
  isSowSuggestedKey,
  suggestPacks,
  suggestedRequirementKeys,
} from "./evidence/catalog.ts";
import {
  evidenceSearchFor,
  parseEvidenceSearch,
  resolveEvidenceStep,
  resolveEvidenceTab,
} from "./evidence/nav.ts";
import { addCadence, cellStatus, staffInitials } from "./evidence/status.ts";
import {
  EVIDENCE_CADENCE_OPTIONS,
  EVIDENCE_DISCLAIMER,
  EVIDENCE_LIABILITY_TEXT,
  EVIDENCE_PUSH_BODY,
  EVIDENCE_UNCHECK_WARNING,
  type EvidenceFileRow,
  type EvidenceItemRow,
  type ServiceCodeFlag,
} from "./evidence/types.ts";

function item(partial: Partial<EvidenceItemRow>): EvidenceItemRow {
  return {
    id: "item-1",
    organization_id: "org-1",
    subject_type: "staff",
    subject_id: "staff-1",
    requirement_key: "cpr_first_aid",
    title: "CPR / First Aid",
    evidence_type: "upload",
    attestation_text: null,
    cadence: "every_2_years",
    sow_cite: "SOW §1.8(5)",
    suggested: true,
    sent_to_staff: false,
    visible_to_staff_id: null,
    dual_link_key: null,
    dual_link_peer_id: null,
    expires_on: null,
    created_at: "2026-09-17T00:00:00.000Z",
    updated_at: "2026-09-17T00:00:00.000Z",
    ...partial,
  };
}

function file(partial: Partial<EvidenceFileRow>): EvidenceFileRow {
  return {
    id: "file-1",
    organization_id: "org-1",
    item_id: "item-1",
    storage_path: "org/item/cpr.pdf",
    filename: "cpr.pdf",
    attested_at: null,
    attested_by: null,
    attestation_text_snapshot: null,
    uploaded_by: "admin-1",
    uploaded_at: "2026-09-01T00:00:00.000Z",
    notes: null,
    ...partial,
  };
}

describe("Evidence curated catalog", () => {
  it("keeps a small curated set — not the mega sheet, no W-9/I-9 built-ins", () => {
    assert.ok(EVIDENCE_REQUIREMENTS.length < 30);
    assert.ok(EVIDENCE_PACKS.length < 20);
    assert.equal(
      EVIDENCE_REQUIREMENTS.some((r) => isBuiltInTaxFormKey(r.key) || /w-?9|i-?9/i.test(r.title)),
      false,
    );
    assert.ok(EVIDENCE_PACKS.some((p) => p.key === "all_staff_starter"));
    assert.ok(EVIDENCE_PACKS.some((p) => p.key === "company_starter"));
    assert.ok(EVIDENCE_REQUIREMENTS.some((r) => r.dualLink === "host_home_cert"));
    assert.equal(
      EVIDENCE_PACKS.every((p) => p.chip.trim().length > 0),
      true,
    );
  });

  it("labels each suggested row with its pack chip", () => {
    const staff = suggestPacks(defaultQuestionnaireAnswers("staff"));
    assert.deepEqual(chipsForRequirementKey("cpr_first_aid", staff), ["All-staff"]);
    assert.deepEqual(chipsForRequirementKey("driving_record", staff), ["Transport"]);
    const hhs = suggestPacks({
      ...defaultQuestionnaireAnswers("staff"),
      serviceCodes: ["HHS"] as ServiceCodeFlag[],
    });
    assert.deepEqual(chipsForRequirementKey("host_home_cert", hhs), ["HHS"]);
    const abi = suggestPacks({
      ...defaultQuestionnaireAnswers("staff"),
      transportsPeople: false,
      worksWithAbi: true,
    });
    assert.deepEqual(chipsForRequirementKey("abi_training", abi), ["ABI"]);
  });

  it("suggests all-staff + transport by default for staff, and gates HHS/SEI/BC", () => {
    const base = defaultQuestionnaireAnswers("staff");
    assert.equal(base.transportsPeople, true);
    const keys = suggestedRequirementKeys(base);
    assert.deepEqual(keys.sort(), [
      "auto_insurance_proof",
      "background_screening",
      "cpr_first_aid",
      "driving_record",
      "thirty_day_orientation",
    ]);
    assert.equal(
      suggestPacks(base).some((p) => p.pack.key === "hhs_staff"),
      false,
    );
    assert.equal(
      suggestPacks(base).some((p) => p.pack.key === "sei"),
      false,
    );

    const hhs = suggestPacks({ ...base, serviceCodes: ["HHS"] });
    assert.ok(hhs.some((p) => p.pack.key === "hhs_staff"));
    assert.equal(
      hhs.some((p) => p.pack.key === "sei"),
      false,
    );

    const sei = suggestPacks({ ...base, serviceCodes: ["SEI"] });
    assert.ok(sei.some((p) => p.pack.key === "sei"));
    assert.equal(
      sei.some((p) => p.pack.key === "hhs_staff"),
      false,
    );

    const bc = suggestPacks({ ...base, serviceCodes: ["BC2"] });
    assert.ok(bc.some((p) => p.pack.key === "bc2_staff"));
    assert.equal(
      bc.some((p) => p.pack.key === "bc1_staff"),
      false,
    );
  });

  it("does not suggest driving when the person does not transport", () => {
    const keys = suggestedRequirementKeys({
      ...defaultQuestionnaireAnswers("staff"),
      transportsPeople: false,
    });
    assert.equal(keys.includes("driving_record"), false);
    assert.ok(keys.includes("cpr_first_aid"));
  });

  it("suggests ABI and Mandt only from those flags", () => {
    const abi = suggestedRequirementKeys({
      ...defaultQuestionnaireAnswers("staff"),
      transportsPeople: false,
      worksWithAbi: true,
    });
    assert.ok(abi.includes("abi_training"));
    assert.equal(abi.includes("mandt_behavior"), false);

    const mandt = suggestedRequirementKeys({
      ...defaultQuestionnaireAnswers("staff"),
      transportsPeople: false,
      maySupportAggressiveBehavior: true,
    });
    assert.ok(mandt.includes("mandt_behavior"));
  });

  it("keeps client HHS dual-link and BC FBA packs conditional", () => {
    const empty = suggestPacks(defaultQuestionnaireAnswers("client"));
    assert.equal(empty.length, 0);
    const hhs = suggestPacks({
      ...defaultQuestionnaireAnswers("client"),
      serviceCodes: ["HHS"],
    });
    assert.deepEqual(
      hhs.map((p) => p.pack.key),
      ["hhs_client"],
    );
    assert.equal(hostHomeDualLinkPeerKey("host_home_cert"), "host_home_cert_client");
    assert.equal(hostHomeDualLinkPeerKey("host_home_cert_client"), "host_home_cert");
  });

  it("treats SOW-suggested rows as the opt-out warning set", () => {
    const answers = {
      ...defaultQuestionnaireAnswers("staff"),
      serviceCodes: ["HHS"] as ServiceCodeFlag[],
    };
    assert.equal(isSowSuggestedKey("cpr_first_aid", answers), true);
    assert.equal(isSowSuggestedKey("host_home_cert", answers), true);
    assert.equal(isSowSuggestedKey("custom_w9", answers), false);
    assert.match(EVIDENCE_UNCHECK_WARNING, /opting out/);
    assert.match(EVIDENCE_LIABILITY_TEXT, /not comprehensive/);
    assert.doesNotMatch(EVIDENCE_DISCLAIMER, /scoreboard percent|Hive Certify/i);
  });
});

describe("Evidence cell status", () => {
  it("marks missing, expiring soon, and done without inventing a score", () => {
    assert.equal(cellStatus({ item: null, file: null, today: "2026-09-17" }), "missing");
    assert.equal(cellStatus({ item: item({}), file: null, today: "2026-09-17" }), "missing");
    assert.equal(
      cellStatus({
        item: item({ expires_on: "2026-10-01" }),
        file: file({}),
        today: "2026-09-17",
      }),
      "expiring",
    );
    assert.equal(
      cellStatus({
        item: item({ expires_on: "2027-03-12" }),
        file: file({}),
        today: "2026-09-17",
      }),
      "done",
    );
    assert.equal(
      cellStatus({
        item: item({ expires_on: "2026-09-01" }),
        file: file({}),
        today: "2026-09-17",
      }),
      "missing",
    );
    assert.equal(addCadence("2026-03-12", "every_2_years"), "2028-03-12");
    assert.equal(addCadence("2026-03-12", "monthly"), "2026-04-12");
    assert.equal(addCadence("2026-03-12", "quarterly"), "2026-06-12");
    assert.equal(addCadence("2026-03-12", "semi_annual"), "2026-09-12");
    assert.equal(addCadence("2026-03-12", "keep_current"), null);
    assert.equal(staffInitials("Dane Warnick"), "DW");
  });

  it("requires attestation timestamp for attest rows", () => {
    const attest = item({ evidence_type: "attestation" });
    assert.equal(
      cellStatus({
        item: attest,
        file: file({ storage_path: null, filename: null, attested_at: null }),
        today: "2026-09-17",
      }),
      "missing",
    );
    assert.equal(
      cellStatus({
        item: attest,
        file: file({
          storage_path: null,
          filename: null,
          attested_at: "2026-09-17T12:00:00.000Z",
        }),
        today: "2026-09-17",
      }),
      "done",
    );
  });
});

describe("Evidence nav + product lock", () => {
  it("resolves Staff / Client / Company and step aliases", () => {
    assert.equal(resolveEvidenceTab("agency"), "company");
    assert.equal(resolveEvidenceTab("clients"), "client");
    assert.equal(resolveEvidenceStep("quiz"), "quiz");
    assert.equal(resolveEvidenceStep("nope"), "grid");
    assert.deepEqual(parseEvidenceSearch({ tab: "client", wizard: "1" }), {
      tab: "client",
      wizard: true,
    });
    assert.deepEqual(evidenceSearchFor({ tab: "company", step: "pack" }), {
      tab: "company",
      step: "pack",
    });
  });

  it("renames admin Obligations/Compliance nav to Evidence and keeps legacy file routes", () => {
    const nav = readFileSync(new URL("./../routes/dashboard.tsx", import.meta.url), "utf8");
    assert.match(nav, /to: "\/dashboard\/evidence", label: "Evidence"/);
    assert.doesNotMatch(nav, /to: "\/dashboard\/compliance", label: "Compliance"/);
    assert.doesNotMatch(nav, /label: "Obligations"/);
    assert.doesNotMatch(nav, /Hive Certify/);

    const evidence = readFileSync(
      new URL("./../routes/dashboard.evidence.tsx", import.meta.url),
      "utf8",
    );
    assert.match(evidence, /createFileRoute\("\/dashboard\/evidence"\)/);
    assert.match(evidence, /Provider Interface/);
    assert.doesNotMatch(evidence, /Hive Certify/);
    assert.doesNotMatch(evidence, /compliance scoreboard/i);

    const company = readFileSync(
      new URL("./../routes/dashboard.company-obligations.tsx", import.meta.url),
      "utf8",
    );
    assert.match(company, /\/dashboard\/evidence/);

    const compliance = readFileSync(
      new URL("./../routes/dashboard.compliance.tsx", import.meta.url),
      "utf8",
    );
    assert.match(compliance, /StaffFilePanel/);
    assert.doesNotMatch(compliance, /EvidencePage/);

    const staffPhone = readFileSync(
      new URL("./../routes/dashboard.my-evidence.tsx", import.meta.url),
      "utf8",
    );
    assert.match(staffPhone, /createFileRoute\("\/dashboard\/my-evidence"\)/);

    const workspace = readFileSync(
      new URL("./../components/evidence/evidence-workspace.tsx", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(workspace, /1 · Grid|EVIDENCE_DISCLAIMER|amber-50/);
    assert.match(workspace, /SubjectAssignPicker/);

    const quiz = readFileSync(
      new URL("./../components/evidence/evidence-questionnaire.tsx", import.meta.url),
      "utf8",
    );
    assert.match(quiz, /data-evidence-quiz/);
    assert.match(quiz, /chipsForRequirementKey/);
    assert.match(quiz, /Attestation/);
    assert.doesNotMatch(quiz, /amber-50|Not called compliance/);
    assert.equal(EVIDENCE_CADENCE_OPTIONS.length, 7);
    assert.deepEqual(
      EVIDENCE_CADENCE_OPTIONS.map((o) => o.value),
      ["once", "monthly", "quarterly", "semi_annual", "annual", "every_2_years", "keep_current"],
    );
  });

  it("does not revive requirement_defs dual-write or encoded applicability", () => {
    const fn = readFileSync(new URL("./evidence.functions.ts", import.meta.url), "utf8");
    assert.doesNotMatch(fn, /\.from\(["']requirement_defs["']\)/);
    assert.doesNotMatch(fn, /\.from\(["']requirement_applicability["']\)/);
    assert.doesNotMatch(fn, /duty-applicability/);
    assert.match(fn, /supabase as AnySupabase|supabase as any/);
    assert.match(fn, /feature_config/);
    assert.match(EVIDENCE_PUSH_BODY, /evidence item/);
    assert.doesNotMatch(EVIDENCE_PUSH_BODY, /client|medicaid|diagnosis/i);

    const migration = fileURLToPath(
      new URL("../../supabase/migrations/20260917220000_evidence_phase1.sql", import.meta.url),
    );
    assert.equal(existsSync(migration), true, migration);
    const sql = readFileSync(migration, "utf8");
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public.evidence_items/);
    assert.doesNotMatch(sql, /DROP TABLE/);
  });

  it("keeps twelve primary admin labels with Evidence in Compliance's slot", () => {
    const labels = readFileSync(new URL("./compliance-nav.ts", import.meta.url), "utf8");
    assert.match(labels, /"Evidence"/);
    assert.doesNotMatch(labels, /"Compliance",/);
  });
});
