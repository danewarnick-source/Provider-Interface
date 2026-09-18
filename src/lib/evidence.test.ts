import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  EVIDENCE_HELP_LINKS,
  EVIDENCE_PACKS,
  EVIDENCE_REQUIREMENTS,
  catalogSubjectsArePartitioned,
  chipsForRequirementKey,
  defaultQuestionnaireAnswers,
  hostHomeDualLinkPeerKey,
  isBuiltInTaxFormKey,
  isSowSuggestedKey,
  requirementByKey,
  suggestPacks,
  suggestedRequirementKeys,
} from "./evidence/catalog.ts";
import {
  evidenceSearchFor,
  leaveEvidenceWizard,
  parseEvidenceSearch,
  resolveEvidenceStep,
  resolveEvidenceTab,
} from "./evidence/nav.ts";
import {
  companyEvidencePerson,
  isAttestFullName,
  isListedEvidenceClient,
  loadEvidenceClientPeople,
  mapClientRowsToPeople,
  mapEmployeeRowsToPeople,
} from "./evidence/people.ts";
import {
  computeFirstDueOn,
  computeNextDueOn,
  dueSubtitle,
  LOCKED_DUE_DEFAULTS,
  needsHireDate,
} from "./evidence/due.ts";
import { columnDueHint, matrixColumns, personRowSubtitle } from "./evidence/matrix.ts";
import { cellStatus, dueChipLabel, matrixChip, staffInitials } from "./evidence/status.ts";
import {
  EVIDENCE_LIABILITY_TEXT,
  EVIDENCE_PUSH_BODY,
  EVIDENCE_STORAGE_UNAVAILABLE,
  STAFF_QUIZ_CODES,
  EVIDENCE_UNCHECK_TITLE,
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
    send_message: null,
    dual_link_key: null,
    dual_link_peer_id: null,
    expires_on: null,
    first_due_rule: "hire_90",
    first_due_on: null,
    document_date: null,
    next_due_on: null,
    renew_years: 2,
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
  it("keeps a curated demo catalog — not the mega sheet, no W-9/I-9 built-ins", () => {
    assert.ok(EVIDENCE_REQUIREMENTS.length < 120);
    assert.ok(EVIDENCE_PACKS.length < 80);
    assert.equal(
      EVIDENCE_REQUIREMENTS.some((r) => isBuiltInTaxFormKey(r.key) || /w-?9|i-?9/i.test(r.title)),
      false,
    );
    assert.ok(EVIDENCE_PACKS.some((p) => p.key === "all_staff"));
    assert.ok(EVIDENCE_PACKS.some((p) => p.key === "client_core"));
    assert.ok(EVIDENCE_PACKS.some((p) => p.key === "company_governance"));
    assert.ok(EVIDENCE_REQUIREMENTS.some((r) => r.dualLink === "host_home_cert"));
    assert.equal(
      EVIDENCE_REQUIREMENTS.every(
        (r) =>
          (r.why.trim().length > 40 && r.cadenceDisplay.includes("·")) || r.key === "lease_housing",
      ),
      true,
    );
    assert.equal(
      EVIDENCE_PACKS.every((p) => p.chip.trim().length > 0),
      true,
    );
    assert.equal(catalogSubjectsArePartitioned(), true);
  });

  it("uses DSPD direct form/PDF hrefs when the forms page publishes them", () => {
    const hrefs = (key: string) => (requirementByKey(key)?.links ?? []).map((l) => l.href);
    assert.deepEqual(hrefs("medicaid_disclosure"), [
      "https://dspd.utah.gov/wp-content/uploads/Employee-Medicaid-Disclosure.pdf",
    ]);
    assert.deepEqual(hrefs("host_home_cert"), [
      "https://dspd.utah.gov/wp-content/uploads/Host-Home-Certification-Requirements.pdf",
    ]);
    assert.deepEqual(hrefs("host_home_cert_client"), [
      "https://dspd.utah.gov/wp-content/uploads/Host-Home-Certification-Requirements.pdf",
    ]);
    assert.deepEqual(hrefs("oig_exclusion"), ["https://exclusions.oig.hhs.gov/"]);
    assert.deepEqual(hrefs("background_screening"), [
      "https://dlbc.utah.gov/background-screening/",
    ]);
    assert.deepEqual(hrefs("form_930"), [
      "https://dspd.utah.gov/wp-content/uploads/Enhanced-Staffing-6-30-26.pdf",
    ]);
    assert.deepEqual(hrefs("sjp_milestone_packet"), [
      "https://dspd.utah.gov/wp-content/uploads/CIE-Milestones-Payment-Request-Form-7-1-26.pdf",
      "https://dspd.utah.gov/wp-content/uploads/CIE-Individualized-strengths-based-discovery-assessment-7-8-26.pdf",
    ]);
    assert.deepEqual(hrefs("sjr_retention_packet"), [
      "https://dspd.utah.gov/wp-content/uploads/CIE-Milestones-Payment-Request-Form-7-1-26.pdf",
    ]);
    assert.deepEqual(hrefs("epr_staff_ready"), [
      "https://dspd.utah.gov/wp-content/uploads/Request-for-Additional-Employment-Preparation-Services-EPR-6-16-26.pdf",
    ]);
    assert.equal(
      EVIDENCE_HELP_LINKS.qualification.href,
      "https://dspd.utah.gov/wp-content/uploads/General-Employee-Qualification.pdf",
    );
    assert.deepEqual(hrefs("thirty_day_orientation"), [
      "https://dspd.utah.gov/wp-content/uploads/General-Employee-Qualification.pdf",
    ]);
    assert.deepEqual(hrefs("pps_foster_license"), [
      "https://dlbc.utah.gov/home/office-of-licensing/human-services/applications-and-renewals/",
      "https://dlbc.utah.gov/home/office-of-licensing/human-services/rules-and-descriptions/",
    ]);
    assert.ok(hrefs("customized_employment_usu").includes("https://jobs.utah.gov/usor/"));
    assert.ok(
      hrefs("customized_employment_usu").includes("https://dspd.utah.gov/providers/forms/"),
    );
  });

  it("does not overlap staff / client / company rows except Host Home Cert dual-link", () => {
    const staff = new Set(
      EVIDENCE_REQUIREMENTS.filter((r) => r.subject === "staff").map((r) => r.key),
    );
    const client = new Set(
      EVIDENCE_REQUIREMENTS.filter((r) => r.subject === "client").map((r) => r.key),
    );
    const company = new Set(
      EVIDENCE_REQUIREMENTS.filter((r) => r.subject === "company").map((r) => r.key),
    );
    assert.equal(
      [...staff].some((k) => client.has(k) || company.has(k)),
      false,
    );
    assert.equal(
      [...client].some((k) => company.has(k)),
      false,
    );
    assert.equal(staff.has("client_photo") || staff.has("client_pcsp"), false);
    assert.equal(
      client.has("cpr_first_aid") ||
        client.has("background_screening") ||
        client.has("mandt_behavior"),
      false,
    );
    assert.equal(company.has("cpr_first_aid") || company.has("bc1_staff_cred"), false);
    assert.equal(hostHomeDualLinkPeerKey("host_home_cert"), "host_home_cert_client");
    assert.equal(hostHomeDualLinkPeerKey("host_home_cert_client"), "host_home_cert");
  });

  it("labels each suggested row with its pack chip", () => {
    const staff = suggestPacks(defaultQuestionnaireAnswers("staff"));
    assert.deepEqual(chipsForRequirementKey("cpr_first_aid", staff), ["All-staff"]);
    assert.deepEqual(chipsForRequirementKey("driving_record", staff), ["Transport"]);
    const hhs = suggestPacks({
      ...defaultQuestionnaireAnswers("staff"),
      serviceCodes: ["HHS"] as ServiceCodeFlag[],
    });
    assert.deepEqual(chipsForRequirementKey("host_home_cert", hhs), ["HHS host"]);
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
    assert.ok(keys.includes("cpr_first_aid"));
    assert.ok(keys.includes("oig_exclusion"));
    assert.ok(keys.includes("annual_12hr_training"));
    assert.ok(keys.includes("person_centered_thinking"));
    assert.ok(keys.includes("driving_record"));
    assert.equal(keys.includes("host_home_cert"), false);
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
    const slh = suggestPacks({ ...base, serviceCodes: ["SLH"] });
    assert.ok(slh.some((p) => p.pack.key === "slh_staff"));
    const dsg = suggestPacks({ ...base, serviceCodes: ["DSG"] });
    assert.ok(dsg.some((p) => p.pack.key === "day_supports_staff"));
    const dsp = suggestPacks({ ...base, serviceCodes: ["DSP"] });
    assert.ok(dsp.some((p) => p.pack.key === "day_supports_staff"));
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

  it("keeps client core always on, and HHS / BC packs conditional", () => {
    const empty = suggestPacks(defaultQuestionnaireAnswers("client"));
    assert.deepEqual(
      empty.map((p) => p.pack.key),
      ["client_core"],
    );
    const hhs = suggestPacks({
      ...defaultQuestionnaireAnswers("client"),
      serviceCodes: ["HHS"],
    });
    assert.deepEqual(
      hhs.map((p) => p.pack.key),
      ["client_core", "hhs_client"],
    );
    assert.ok(
      suggestedRequirementKeys(
        hhs[0]
          ? { ...defaultQuestionnaireAnswers("client"), serviceCodes: ["HHS"] }
          : defaultQuestionnaireAnswers("client"),
      ).includes("host_home_cert_client"),
    );
  });

  it("treats SOW-suggested rows as the opt-out warning set", () => {
    const answers = {
      ...defaultQuestionnaireAnswers("staff"),
      serviceCodes: ["HHS"] as ServiceCodeFlag[],
    };
    assert.equal(isSowSuggestedKey("cpr_first_aid", answers), true);
    assert.equal(isSowSuggestedKey("host_home_cert", answers), true);
    assert.equal(isSowSuggestedKey("annual_12hr_training", answers), true);
    assert.equal(isSowSuggestedKey("custom_w9", answers), false);
    assert.equal(EVIDENCE_UNCHECK_TITLE, "Are you sure?");
    assert.match(EVIDENCE_UNCHECK_WARNING, /requirement in the SOW/);
    assert.match(EVIDENCE_LIABILITY_TEXT, /suggestions only/i);
    assert.match(EVIDENCE_LIABILITY_TEXT, /ultimately responsible/);
    assert.doesNotMatch(EVIDENCE_LIABILITY_TEXT, /scoreboard percent|Hive Certify/i);
  });

  it("wires company OL standing, SEE job-coach, EPR supervisor, and annual 12-hour training", () => {
    const companyKeys = suggestedRequirementKeys(defaultQuestionnaireAnswers("company"));
    for (const key of [
      "company_ol_day_treatment_license",
      "company_ol_day_support_cert",
      "company_ol_residential_support_license",
      "company_ol_residential_support_cert",
      "company_ol_child_placing_foster",
      "company_designated_acre_holder",
    ]) {
      assert.ok(companyKeys.includes(key), key);
      assert.equal(requirementByKey(key)?.subject, "company");
    }
    const companyPacks = suggestPacks(defaultQuestionnaireAnswers("company")).map(
      (row) => row.pack.key,
    );
    assert.ok(companyPacks.includes("company_ol_day"));
    assert.ok(companyPacks.includes("company_ol_residential"));
    assert.ok(companyPacks.includes("company_ol_pps"));
    assert.ok(companyPacks.includes("company_acre_standing"));
    assert.equal(companyPacks.includes("company_optional"), false);

    const staff = defaultQuestionnaireAnswers("staff");
    const see = suggestedRequirementKeys({ ...staff, serviceCodes: ["SEE"] });
    assert.ok(see.includes("see_workplace_supports_or_job_coach"));
    assert.equal(see.includes("customized_employment_usu"), false);
    const sjd = suggestedRequirementKeys({ ...staff, serviceCodes: ["SJD"] });
    assert.ok(sjd.includes("customized_employment_usu"));
    assert.equal(sjd.includes("see_workplace_supports_or_job_coach"), false);
    const epr = suggestedRequirementKeys({ ...staff, serviceCodes: ["EPR"] });
    assert.ok(epr.includes("epr_supervisor_acre_or_usu"));
    assert.ok(epr.includes("epr_staff_ready"));

    const dayWhy = requirementByKey("day_supports_staff")?.why ?? "";
    assert.match(dayWhy, /company_ol_day_treatment_license/);
    assert.match(dayWhy, /company_ol_day_support_cert/);
    assert.doesNotMatch(dayWhy, /Site licenses live on the company file; this is the staff assignment record/);

    const ppsWhy = requirementByKey("pps_foster_license")?.why ?? "";
    assert.match(ppsWhy, /company_ol_child_placing_foster/);
    assert.match(ppsWhy, /company file/);

    const hrefs = (key: string) => (requirementByKey(key)?.links ?? []).map((link) => link.href);
    assert.ok(
      hrefs("company_ol_day_treatment_license").includes(
        "https://dlbc.utah.gov/home/office-of-licensing/human-services/applications-and-renewals/",
      ),
    );
    assert.ok(
      hrefs("annual_12hr_training").includes("https://dspd.utah.gov/providers/trainings/"),
    );
    assert.ok(
      hrefs("see_workplace_supports_or_job_coach").includes("https://jobs.utah.gov/usor/"),
    );
  });

  it("locks first-due / next-due defaults and kills once/keep-current labels", () => {
    assert.deepEqual(LOCKED_DUE_DEFAULTS.thirty_day_orientation, {
      firstDueRule: "hire_30",
      renewYears: null,
    });
    assert.deepEqual(LOCKED_DUE_DEFAULTS.cpr_first_aid, {
      firstDueRule: "hire_90",
      renewYears: 2,
    });
    assert.deepEqual(LOCKED_DUE_DEFAULTS.person_centered_thinking, {
      firstDueRule: "hire_90",
      renewYears: null,
    });
    assert.deepEqual(LOCKED_DUE_DEFAULTS.mandt_behavior, {
      firstDueRule: "hire_180",
      renewYears: 2,
    });
    assert.equal(requirementByKey("cpr_first_aid")?.dueDefault.renewYears, 2);
    assert.equal(requirementByKey("thirty_day_orientation")?.dueDefault.firstDueRule, "hire_30");
    assert.equal(requirementByKey("person_centered_thinking")?.subject, "staff");
    assert.match(
      dueSubtitle({ firstDueRule: "hire_90", renewYears: 2 }),
      /First due within 90 days of hire · then every 2 years from the certificate date/,
    );
    assert.equal(computeFirstDueOn({ rule: "hire_30", hireDate: "2026-07-01" }), "2026-07-31");
    assert.equal(computeFirstDueOn({ rule: "hire_90", hireDate: "2026-07-01" }), "2026-09-29");
    assert.equal(computeFirstDueOn({ rule: "hire_180", hireDate: "2026-07-01" }), "2026-12-28");
    assert.equal(computeFirstDueOn({ rule: "before_first_shift", hireDate: "2026-07-01" }), "2026-07-01");
    assert.equal(computeFirstDueOn({ rule: "set_date", hireDate: "2026-07-01", setDate: "2026-08-15" }), "2026-08-15");
    assert.equal(computeNextDueOn({ documentDate: "2026-03-12", renewYears: 2 }), "2028-03-12");
    assert.equal(computeNextDueOn({ documentDate: "2026-03-12", renewYears: 1 }), "2027-03-12");
    assert.equal(computeNextDueOn({ documentDate: "2026-03-12", renewYears: null }), null);
    assert.equal(
      needsHireDate({
        subject: "staff",
        rule: "hire_90",
        hireDate: null,
      }),
      true,
    );
    assert.equal(
      needsHireDate({
        subject: "company",
        rule: "hire_90",
        hireDate: null,
      }),
      false,
    );
    for (const row of EVIDENCE_REQUIREMENTS) {
      assert.doesNotMatch(row.cadenceDisplay, /\bonce\b|keep current/i);
    }
  });
});

describe("Evidence people roster", () => {
  it("lists discharged and inactive clients, hides only archived", () => {
    assert.equal(isListedEvidenceClient("active"), true);
    assert.equal(isListedEvidenceClient("discharged"), true);
    assert.equal(isListedEvidenceClient("inactive"), true);
    assert.equal(isListedEvidenceClient(null), true);
    assert.equal(isListedEvidenceClient("archived"), false);
    assert.equal(isListedEvidenceClient("Archived"), false);
  });

  it("maps client rows and surfaces query errors instead of an empty roster", async () => {
    const people = mapClientRowsToPeople([
      {
        id: "c-2",
        first_name: "Bea",
        last_name: "Stone",
        account_status: "active",
        authorized_dspd_codes: ["HHS"],
      },
      {
        id: "c-1",
        first_name: "Ann",
        last_name: "Lee",
        account_status: "discharged",
        job_code: ["SLN"],
      },
      {
        id: "c-3",
        first_name: "Gone",
        last_name: "Client",
        account_status: "archived",
      },
    ]);
    assert.deepEqual(
      people.map((p) => p.id),
      ["c-1", "c-2"],
    );
    assert.equal(people[0]?.subtitle, "SLN");
    assert.equal(people[1]?.subtitle, "HHS");

    const failed = await loadEvidenceClientPeople(async () => ({
      data: null,
      error: { message: "permission denied for table clients" },
    }));
    assert.deepEqual(failed.people, []);
    assert.match(failed.error ?? "", /permission denied/);

    const slim = await loadEvidenceClientPeople(async (columns) => {
      if (columns.includes("job_code")) {
        return { data: null, error: { message: "column job_code does not exist" } };
      }
      return {
        data: [
          {
            id: "c-9",
            first_name: "Pat",
            last_name: "Ng",
            account_status: "active",
          },
        ],
        error: null,
      };
    });
    assert.equal(slim.error, null);
    assert.equal(slim.people[0]?.full_name, "Pat Ng");
  });

  it("maps the Employees-page active roster and always names the company row", () => {
    const people = mapEmployeeRowsToPeople([
      {
        user_id: "e-2",
        role: "dsp",
        job_title: "DSP",
        active: true,
        profile: { full_name: "Bea Stone", account_status: "active", is_active: true },
      },
      {
        user_id: "e-1",
        role: "admin",
        job_title: "Owner",
        active: true,
        profile: { full_name: "Ann Lee", account_status: "active", is_active: true },
      },
      {
        user_id: "e-3",
        role: "dsp",
        job_title: "DSP",
        active: false,
        profile: { full_name: "Off Roster", account_status: "active", is_active: true },
      },
      {
        user_id: "e-4",
        role: "dsp",
        job_title: "DSP",
        active: true,
        profile: { full_name: "Archived Emp", account_status: "archived", is_active: true },
      },
      {
        user_id: "e-5",
        role: "dsp",
        job_title: "DSP",
        active: true,
        profile: { full_name: "Inactive Emp", account_status: "active", is_active: false },
      },
    ]);
    assert.deepEqual(
      people.map((p) => p.id),
      ["e-1", "e-2"],
    );
    assert.equal(people[0]?.subtitle, "Owner");
    const company = companyEvidencePerson("org-1", "True North Supports LLC");
    assert.equal(company.id, "org-1");
    assert.equal(company.full_name, "True North Supports LLC");
    const withHire = mapEmployeeRowsToPeople([
      {
        user_id: "e-9",
        role: "dsp",
        job_title: "DSP",
        active: true,
        profile: {
          full_name: "Pat Hire",
          account_status: "active",
          is_active: true,
          hire_date: "2026-07-01",
        },
      },
    ]);
    assert.equal(withHire[0]?.hire_date, "2026-07-01");
    assert.equal(isAttestFullName("Dane", "Warnick"), true);
    assert.equal(isAttestFullName("Dane", "  "), false);
    assert.equal(isAttestFullName("", "Warnick"), false);
  });
});

describe("Evidence cell status", () => {
  it("marks missing and done without inventing a score", () => {
    assert.equal(cellStatus({ item: null, file: null, today: "2026-09-17" }), "missing");
    assert.equal(cellStatus({ item: item({}), file: null, today: "2026-09-17" }), "missing");
    assert.equal(
      cellStatus({
        item: item({ next_due_on: "2026-10-01", expires_on: "2026-10-01" }),
        file: file({}),
        today: "2026-09-17",
      }),
      "done",
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
    assert.equal(staffInitials("Dane Warnick"), "DW");
  });

  it("maps matrix chips from existing due and file fields", () => {
    assert.deepEqual(matrixChip({ item: null, file: null, today: "2026-09-17" }), {
      kind: "na",
      label: "N/A",
      itemId: null,
    });
    assert.deepEqual(matrixChip({ item: item({}), file: null, today: "2026-09-17" }), {
      kind: "add",
      label: "Add",
      itemId: "item-1",
    });
    assert.deepEqual(
      matrixChip({
        item: item({ sent_to_staff: true }),
        file: null,
        today: "2026-09-17",
      }),
      { kind: "review", label: "Review", itemId: "item-1" },
    );
    assert.deepEqual(
      matrixChip({
        item: item({ first_due_on: "2026-10-03" }),
        file: null,
        today: "2026-09-17",
      }),
      { kind: "due", label: "Due in 16d", itemId: "item-1" },
    );
    assert.equal(dueChipLabel(0), "Due today");
    assert.deepEqual(
      matrixChip({
        item: item({ first_due_on: "2026-09-01" }),
        file: null,
        today: "2026-09-17",
      }),
      { kind: "missing", label: "Missing", itemId: "item-1" },
    );
    assert.deepEqual(
      matrixChip({
        item: item({ next_due_on: "2027-03-12", expires_on: "2027-03-12" }),
        file: file({}),
        today: "2026-09-17",
      }),
      { kind: "complete", label: "Complete", itemId: "item-1" },
    );
    assert.deepEqual(
      matrixChip({
        item: item({ next_due_on: "2026-09-01", expires_on: "2026-09-01" }),
        file: file({}),
        today: "2026-09-17",
      }),
      { kind: "missing", label: "Missing", itemId: "item-1" },
    );
  });

  it("builds columns from assigned keys and pack subtitles without fractions", () => {
    const cols = matrixColumns([
      item({ requirement_key: "cpr_first_aid", title: "CPR / First Aid" }),
      item({ id: "item-2", requirement_key: "thirty_day_orientation", title: "30-day orientation" }),
      item({ id: "item-3", requirement_key: "custom_policy", title: "Policy acknowledgment" }),
    ]);
    assert.deepEqual(
      cols.map((c) => c.key),
      ["cpr_first_aid", "thirty_day_orientation", "custom_policy"],
    );
    assert.equal(columnDueHint({ firstDueRule: "hire_90", renewYears: 2 }), "90-day · 2 yr");
    assert.equal(columnDueHint({ firstDueRule: "before_first_shift", renewYears: null }), "On hire");
    const subtitle = personRowSubtitle({
      person: { id: "s1", full_name: "Ann Lee", initials: "AL", subtitle: "DSP" },
      requirementKeys: ["cpr_first_aid", "thirty_day_orientation"],
    });
    assert.match(subtitle, /DSP/);
    assert.doesNotMatch(subtitle, /\d+\s*\/\s*\d+/);
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
    assert.equal(resolveEvidenceTab("employees"), "staff");
    assert.equal(resolveEvidenceTab("employee"), "staff");
    assert.equal(resolveEvidenceTab("staff"), "staff");
    assert.equal(resolveEvidenceStep("quiz"), "quiz");
    assert.equal(resolveEvidenceStep("pack"), "quiz");
    assert.equal(resolveEvidenceStep("nope"), "grid");
    assert.deepEqual(parseEvidenceSearch({ tab: "client", wizard: "1" }), {
      tab: "client",
      step: "quiz",
    });
    assert.deepEqual(evidenceSearchFor({ tab: "company", step: "quiz" }), {
      tab: "company",
      step: "quiz",
    });
    assert.deepEqual(leaveEvidenceWizard("company"), { tab: "company" });
    assert.deepEqual(leaveEvidenceWizard("staff"), { tab: "staff" });
    assert.equal("person" in leaveEvidenceWizard("client"), false);
    assert.equal("step" in leaveEvidenceWizard("client"), false);
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
    const staffList = readFileSync(
      new URL("./../components/evidence/staff-evidence-list.tsx", import.meta.url),
      "utf8",
    );
    assert.match(staffList, /send_message/);
    assert.match(staffList, /Message from your agency/);

    const workspace = readFileSync(
      new URL("./../components/evidence/evidence-workspace.tsx", import.meta.url),
      "utf8",
    );
    const cards = readFileSync(
      new URL("./../components/evidence/evidence-subject-cards.tsx", import.meta.url),
      "utf8",
    );
    const matrix = readFileSync(
      new URL("./../components/evidence/evidence-matrix.tsx", import.meta.url),
      "utf8",
    );
    const chips = readFileSync(
      new URL("./../components/evidence/evidence-status-chip.tsx", import.meta.url),
      "utf8",
    );
    const evidenceUi = `${workspace}\n${cards}\n${matrix}\n${chips}`;
    assert.doesNotMatch(workspace, /1 · Grid|EVIDENCE_DISCLAIMER|amber-50/);
    assert.doesNotMatch(
      workspace,
      />Settings<|>Hire questionnaire|Get started with Evidence|Skip for now|GetStartedPanel|skipGetStarted/,
    );
    assert.match(workspace, /onAddForPerson/);
    assert.match(workspace, /fetchEvidenceClientPeople/);
    assert.match(workspace, /fetchEvidenceEmployees/);
    assert.match(workspace, /companyEvidencePerson/);
    assert.match(cards, /title: "Employees"/);
    assert.match(cards, /title: "Clients"/);
    assert.match(cards, /title: "Company"/);
    assert.match(cards, /\{card\.title\}/);
    assert.match(workspace, /Records & renewals/);
    assert.match(matrix, /Select a cell to add or review evidence/);
    assert.match(chips, /EvidenceStatusChip/);
    assert.match(chips, /complete|missing|review|"na"/);
    assert.doesNotMatch(evidenceUi, />Staff</);
    assert.doesNotMatch(workspace, /Company file is empty/);
    assert.doesNotMatch(workspace, /No rows yet\. Use Add to apply a pack/);
    assert.doesNotMatch(workspace, /Send to staff/);
    assert.match(workspace, /Send to employee/);
    assert.match(workspace, /leaveEvidenceWizard/);
    assert.match(workspace, /person: null/);
    assert.doesNotMatch(workspace, /\.from\(["']clients["']\)/);
    assert.doesNotMatch(workspace, /SubjectAssignPicker|PackSettingsPanel|NewRequirementPanel/);
    assert.doesNotMatch(evidenceUi, /Progress|progress-bar|compliance scoreboard|Hive Certify/i);
    assert.doesNotMatch(evidenceUi, /\d+\s*\/\s*\d+\s*(complete|done|packs|requirements)/i);
    assert.doesNotMatch(evidenceUi, /need attention|KPI|sparkline/i);
    assert.doesNotMatch(evidenceUi, /\p{Extended_Pictographic}/u);

    const fetchClients = readFileSync(
      new URL("./evidence/fetch-clients.ts", import.meta.url),
      "utf8",
    );
    assert.match(fetchClients, /supabase as any/);
    assert.match(fetchClients, /\.from\(["']clients["']\)/);

    const fetchEmployees = readFileSync(
      new URL("./evidence/fetch-employees.ts", import.meta.url),
      "utf8",
    );
    assert.match(fetchEmployees, /supabase as any/);
    assert.match(fetchEmployees, /\.from\(["']organization_members["']\)/);
    assert.match(fetchEmployees, /mapEmployeeRowsToPeople/);
    assert.match(fetchEmployees, /hire_date/);

    const quiz = readFileSync(
      new URL("./../components/evidence/evidence-questionnaire.tsx", import.meta.url),
      "utf8",
    );
    assert.match(quiz, /data-evidence-quiz/);
    assert.match(quiz, /See employee suggestions|See client suggestions/);
    assert.match(quiz, /Add custom evidence/);
    assert.match(quiz, /Create a form/);
    assert.match(quiz, /Attestation/);
    assert.match(quiz, /exclusions.oig.hhs.gov|row.why|row.links/);
    assert.match(quiz, /AlertDialog/);
    assert.match(quiz, /evidence-attest-first/);
    assert.match(quiz, /evidence-attest-last/);
    assert.match(quiz, /isAttestFullName/);
    assert.match(quiz, /Escape/);
    assert.doesNotMatch(quiz, /Keep suggested|Uncheck anyway/);
    assert.doesNotMatch(quiz, /A checkbox alone is not enough/);
    assert.doesNotMatch(quiz, /Employee suggestions \(personnel\)/);
    assert.doesNotMatch(quiz, /Each item has a short plain-English explanation/);
    assert.doesNotMatch(quiz, /Client: person-file packs/);
    assert.doesNotMatch(quiz, /Client setup — services on this person/);
    assert.doesNotMatch(quiz, /amber-50|Not called compliance/);
    assert.ok(STAFF_QUIZ_CODES.includes("SLH"));
    assert.ok(STAFF_QUIZ_CODES.includes("DSG"));
    assert.ok(STAFF_QUIZ_CODES.includes("DSP"));
    assert.ok(STAFF_QUIZ_CODES.includes("SJD"));
    assert.ok(STAFF_QUIZ_CODES.includes("COM"));
    assert.match(quiz, /EvidenceDueFields/);
    assert.doesNotMatch(quiz, /evidence-custom-cadence|Keep current|>Once</);
    const dueFields = readFileSync(
      new URL("./../components/evidence/evidence-due-fields.tsx", import.meta.url),
      "utf8",
    );
    assert.match(dueFields, /First due/);
    assert.match(dueFields, /Next due after on file/);
    assert.match(dueFields, /Set a date/);
    const dueLib = readFileSync(new URL("./evidence/due.ts", import.meta.url), "utf8");
    assert.match(dueLib, /Document date \+ 2 years/);
    assert.doesNotMatch(dueFields, /keep current|>Once</);
    assert.match(workspace, /dueSubtitleFromItem|Save due dates/);
    assert.doesNotMatch(workspace, />Once<|>Keep current</);
  });

  it("does not revive requirement_defs dual-write or encoded applicability", () => {
    const fn = readFileSync(new URL("./evidence.functions.ts", import.meta.url), "utf8");
    assert.doesNotMatch(fn, /\.from\(["']requirement_defs["']\)/);
    assert.doesNotMatch(fn, /\.from\(["']requirement_applicability["']\)/);
    assert.doesNotMatch(fn, /duty-applicability/);
    assert.match(fn, /supabase as AnySupabase|supabase as any/);
    assert.doesNotMatch(fn, /\.select\(["']feature_config["']\)|feature_config:/);
    assert.match(fn, /EVIDENCE_STORAGE_UNAVAILABLE/);
    assert.doesNotMatch(fn, /readFeatureStore|writeFeatureStore|evidence_v1/);
    assert.match(fn, /send_message/);
    assert.match(fn, /hasSendMessage|sendMessageColumnMissing/);
    assert.match(fn, /first_due_rule|dueColumnMissing/);
    const dueSql = fileURLToPath(
      new URL("../../supabase/migrations/20260918070000_evidence_due_model.sql", import.meta.url),
    );
    assert.equal(existsSync(dueSql), true, dueSql);
    assert.match(readFileSync(dueSql, "utf8"), /ADD COLUMN IF NOT EXISTS first_due_rule/);
    assert.match(readFileSync(dueSql, "utf8"), /ADD COLUMN IF NOT EXISTS document_date/);
    assert.doesNotMatch(readFileSync(dueSql, "utf8"), /feature_config/);
    assert.match(EVIDENCE_STORAGE_UNAVAILABLE, /isn’t set up on this database yet/);
    const sendSql = fileURLToPath(
      new URL(
        "../../supabase/migrations/20260918053000_evidence_send_message.sql",
        import.meta.url,
      ),
    );
    assert.equal(existsSync(sendSql), true, sendSql);
    assert.match(readFileSync(sendSql, "utf8"), /ADD COLUMN IF NOT EXISTS send_message/);
    assert.doesNotMatch(readFileSync(sendSql, "utf8"), /\.from\(["']organizations["']\)/);
    assert.match(fn, /peopleError/);
    assert.match(fn, /loadEvidenceClientPeople/);
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
