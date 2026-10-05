import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  hasValidObligationEvidence,
  isAwaitingEvidenceReview,
  isCorrectionRequestedEvidence,
  dueLabel,
  liveObligationTitle,
  csvCell,
  missingPersonnelCsv,
  obligationFileStatus,
  obligationFileStatusLabel,
  staffFileCycleKind,
  statusForObligationInstance,
} from "./file.ts";

const now = new Date("2026-09-10T12:00:00.000Z");

describe("obligationFileStatus", () => {
  it("labels completed and waived as On file", () => {
    assert.equal(
      obligationFileStatus({
        instanceStatus: "completed",
        dueAt: "2026-09-01T00:00:00.000Z",
        hasValidEvidence: true,
        now,
      }),
      "on_file",
    );
    assert.equal(
      obligationFileStatus({
        instanceStatus: "waived",
        dueAt: "2026-08-01T00:00:00.000Z",
        hasValidEvidence: true,
        now,
      }),
      "on_file",
    );
    assert.equal(obligationFileStatusLabel("on_file"), "On file");
  });

  it("labels an open duty due within 7 days as Due soon", () => {
    assert.equal(
      obligationFileStatus({
        instanceStatus: "pending",
        dueAt: "2026-09-14T12:00:00.000Z",
        hasValidEvidence: false,
        now,
      }),
      "due_soon",
    );
    assert.equal(obligationFileStatusLabel("due_soon"), "Due soon");
  });

  it("labels overdue and far-future open duties as Missing — never Have", () => {
    assert.equal(
      obligationFileStatus({
        instanceStatus: "overdue",
        dueAt: "2026-09-01T00:00:00.000Z",
        hasValidEvidence: false,
        now,
      }),
      "missing",
    );
    assert.equal(
      obligationFileStatus({
        instanceStatus: "pending",
        dueAt: "2026-12-01T00:00:00.000Z",
        hasValidEvidence: false,
        now,
      }),
      "missing",
    );
    assert.equal(obligationFileStatusLabel("missing"), "Missing");
    assert.notEqual(obligationFileStatusLabel("on_file"), "Have");
  });
});

describe("hasValidObligationEvidence", () => {
  it("rejects a Nectar-failed completion", () => {
    assert.equal(
      hasValidObligationEvidence({
        instanceStatus: "pending",
        hasCompletion: true,
        nectarValidationStatus: "failed",
      }),
      false,
    );
  });

  it("does not treat a pending upload as accepted", () => {
    assert.equal(
      hasValidObligationEvidence({
        instanceStatus: "pending",
        hasCompletion: true,
        nectarValidationStatus: "passed",
      }),
      false,
    );
    assert.equal(
      hasValidObligationEvidence({
        instanceStatus: "pending",
        hasCompletion: true,
        nectarValidationStatus: "needs_review",
      }),
      false,
    );
    assert.equal(
      hasValidObligationEvidence({
        instanceStatus: "completed",
        hasCompletion: false,
        nectarValidationStatus: null,
      }),
      true,
    );
    assert.equal(
      hasValidObligationEvidence({
        instanceStatus: "overdue",
        hasCompletion: false,
        nectarValidationStatus: null,
      }),
      false,
    );
    assert.equal(
      isAwaitingEvidenceReview({
        instanceStatus: "pending",
        nectarValidationStatus: "needs_review",
      }),
      true,
    );
    assert.equal(
      isAwaitingEvidenceReview({
        instanceStatus: "pending",
        nectarValidationStatus: "failed",
        correctionRequested: true,
      }),
      false,
    );
    assert.equal(
      isAwaitingEvidenceReview({
        instanceStatus: "overdue",
        nectarValidationStatus: "failed",
        adminNotes: "Correction requested: Show the expiration date.",
      }),
      false,
    );
    assert.equal(
      isCorrectionRequestedEvidence({
        adminNotes: "Correction requested: Show the expiration date.",
      }),
      true,
    );
  });

  it("keeps a completed cycle as previous when a renewal instance is open", () => {
    const peers = [
      {
        instanceId: "old",
        instanceStatus: "completed" as const,
        dueAt: "2026-01-01T00:00:00.000Z",
      },
      { instanceId: "next", instanceStatus: "pending" as const, dueAt: "2027-01-01T00:00:00.000Z" },
    ];
    assert.equal(
      staffFileCycleKind({
        instanceId: "old",
        instanceStatus: "completed",
        dueAt: "2026-01-01T00:00:00.000Z",
        peers,
      }),
      "previous",
    );
    assert.equal(
      staffFileCycleKind({
        instanceId: "next",
        instanceStatus: "pending",
        dueAt: "2027-01-01T00:00:00.000Z",
        peers,
      }),
      "current",
    );
  });
});

describe("liveObligationTitle", () => {
  it("uses the live obligation name and substitutes client name", () => {
    assert.equal(
      liveObligationTitle("CPR certification", "staff", "JANE DOE"),
      "CPR certification",
    );
    assert.equal(
      liveObligationTitle(
        "Client-Specific Training — [Client Name]",
        "staff_per_client",
        "JANE DOE",
      ),
      "Client-Specific Training — Jane Doe",
    );
  });
});

describe("dueLabel", () => {
  it("labels past dues as Missing, not Overdue", () => {
    const label = dueLabel("2026-09-01T00:00:00.000Z", now);
    assert.equal(label.overdue, true);
    assert.match(label.text, /Missing/);
    assert.doesNotMatch(label.text, /Overdue/);
  });
});

describe("Admin team member profile lock", () => {
  const read = (f: string) =>
    readFileSync(new URL(`../../components/team-members/profile/${f}`, import.meta.url), "utf8");

  it("draws Overview · Profile · Team member file · Training · Caseload · Notes · Activity and drops junk surfaces", () => {
    const src = read("profile-page.tsx");
    assert.match(src, /visibleProfileTabs\(\{ canSeeNotes \}\)/);
    assert.match(src, /resolveProfileTab\(tab, \{ canSeeNotes \}\)/);
    assert.match(src, /<ProfileShell/);
    assert.doesNotMatch(src, /TabsList|TabsTrigger/);
    for (const v of ["overview", "profile", "file", "training", "caseload", "notes", "activity"]) {
      assert.match(src, new RegExp(`activeTab === "${v}"`));
    }
    assert.match(src, /StaffProfilePanel/);
    assert.match(src, /data-testid="profile-load-error"/);
    assert.match(src, /data-testid="profile-not-found"/);
    assert.doesNotMatch(src, />Staff file</);
    assert.doesNotMatch(src, /Personnel file/);
    assert.doesNotMatch(src, /value="personnel"/);
    assert.doesNotMatch(src, /<TabsTrigger value="permissions">/);
    assert.doesNotMatch(src, /Obligations & files/);
    assert.doesNotMatch(src, /Document Vault/);
    assert.doesNotMatch(src, /Suggested CE/);
    assert.doesNotMatch(src, /Custom attributes/);
    assert.doesNotMatch(src, /StaffDeadlinesList/);
    assert.doesNotMatch(src, /EmployeeDocumentsCard/);
    assert.doesNotMatch(src, /LifecyclePanel/);
    assert.doesNotMatch(src, /Back to list/);
    assert.doesNotMatch(src, /profile-access-badge/);
  });

  it("Profile tab: Contact, Employment and Access; one Edit / Save / Cancel; no Access level field", () => {
    const panel = read("profile-tab.tsx");
    for (const label of [
      "Contact",
      "Employment",
      "Home address",
      "Emergency contact",
      "Date of birth",
      "Job title",
      "Change in Access",
      "Supervisor",
      "Hire date",
      "Worker type",
      "Transports clients",
      "Staff type",
      "Team member ID",
      "Hourly rate",
      "Daily rate",
      "Upcoming time off",
      "New suggestion: transport items",
    ]) {
      assert.ok(panel.includes(label), label);
    }
    assert.match(panel, /AccessSection/);
    assert.match(panel, /isAdminLevel \?/);
    assert.match(panel, /updateTeamMember/);
    assert.equal((panel.match(/>\s*Edit\s*</g) ?? []).length, 1);
    assert.doesNotMatch(panel, /Access level/);
    assert.doesNotMatch(panel, /memberBelongsToRouteStaff/);
    assert.doesNotMatch(panel, /Department/);
    assert.doesNotMatch(panel, /\bemployee\b/i);
  });

  it("no browser-side writes to profiles or organization_members in the profile components", () => {
    for (const f of [
      "profile-page.tsx",
      "profile-header.tsx",
      "profile-tab.tsx",
      "photo-card.tsx",
      "notes-tab.tsx",
      "activity-tab.tsx",
    ]) {
      const src = read(f);
      assert.doesNotMatch(src, /from\("profiles"\)|from\("organization_members"\)/, f);
      assert.doesNotMatch(src, /integrations\/supabase\/client"/, f);
    }
    assert.match(read("photo-card.tsx"), /imageTypes=\{\["image\/png", "image\/jpeg"\]\}/);
  });

  it("header: back link, status chip, Evidence badges and the ⋯ menu", () => {
    const header = read("profile-header.tsx");
    assert.match(header, /← Team Members|ArrowLeft[\s\S]*Team Members/);
    assert.match(header, /profileBadges\(/);
    assert.match(header, /MEMBER_STATUS_LABEL/);
    for (const label of [
      "Review evidence pack",
      "Staff record",
      "Download",
      "Print",
      "Save to documents",
      "Reset password…",
      "Send invite",
      "Resend invite",
      "Deactivate…",
      "Reactivate",
    ]) {
      assert.ok(header.includes(label), label);
    }
    assert.match(header, /tab: "file"/);
    assert.doesNotMatch(header, /company_obligation/);
  });
});

describe("statusForObligationInstance", () => {
  it("matches the per-person On file / Due soon / Missing engine", () => {
    assert.equal(
      statusForObligationInstance({
        instanceStatus: "completed",
        dueAt: "2026-09-01T00:00:00.000Z",
        now,
      }),
      "on_file",
    );
    assert.equal(
      statusForObligationInstance({
        instanceStatus: "pending",
        dueAt: "2026-09-14T12:00:00.000Z",
        now,
      }),
      "due_soon",
    );
    assert.equal(
      statusForObligationInstance({
        instanceStatus: "pending",
        dueAt: "2026-12-01T00:00:00.000Z",
        completion: { nectar_validation_status: "failed" },
        now,
      }),
      "missing",
    );
  });
});

describe("missingPersonnelCsv", () => {
  it("exports missing items without inventing Have", () => {
    const csv = missingPersonnelCsv([
      {
        full_name: "Jordan Lee",
        role: "employee",
        job_title: "DSP",
        service_codes: ["HHS", "DSI"],
        missing: 2,
        due_soon: 1,
        on_file: 4,
        missing_items: [
          { title: "CPR certification", due_at: "2026-08-01T00:00:00.000Z" },
          { title: "Code of Conduct", due_at: "2026-09-01T00:00:00.000Z" },
        ],
      },
    ]);
    assert.match(csv, /Jordan Lee/);
    assert.match(csv, /HHS DSI/);
    assert.match(csv, /CPR certification; Code of Conduct/);
    assert.doesNotMatch(csv, /Have/);
  });
});

describe("Staff staff-file page lock", () => {
  it("renames the staff surface and keeps 30-day course or upload on one card", () => {
    const src = readFileSync(
      new URL("../../routes/dashboard.my-obligations.tsx", import.meta.url),
      "utf8",
    );
    assert.match(src, /title: "Staff file/);
    assert.match(src, /My tasks/);
    assert.match(src, /Or upload a certificate/);
    assert.match(src, /A certificate upload clears this same 30-day card/);
    assert.match(src, /A certificate upload clears this same hire-level PCT card/);
    assert.doesNotMatch(src, /hasCompletion && !failedValidation/);
    assert.match(src, /Uploaded is not accepted/);
    assert.doesNotMatch(src, /title="My Obligations"/);
    assert.doesNotMatch(src, /My Compliance/);
  });

  it("does not assign an all-staff driving_record baseline", () => {
    const src = readFileSync(new URL("../staff-training-requirements.ts", import.meta.url), "utf8");
    assert.doesNotMatch(src, /key: "driving_record"/);
  });
});

describe("Org-wide Staff file lock", () => {
  it("folds Staff file under Admin Compliance and keeps the legacy URL", () => {
    const nav = readFileSync(new URL("../../routes/dashboard.tsx", import.meta.url), "utf8");
    assert.match(nav, /to: "\/dashboard\/evidence", label: "Evidence"/);
    assert.doesNotMatch(nav, /label: "State Audit"/);
    assert.doesNotMatch(nav, /to: "\/dashboard\/personnel-file", label: "/);
    assert.doesNotMatch(nav, /label: "Personnel file"/);
    const route = readFileSync(
      new URL("../../routes/dashboard.personnel-file.tsx", import.meta.url),
      "utf8",
    );
    assert.match(route, /createFileRoute\("\/dashboard\/personnel-file"\)/);
    assert.match(route, /\/dashboard\/compliance/);
    assert.match(route, /tab: "staff"/);
    assert.match(route, /redirect/);
    const panel = readFileSync(
      new URL("../../components/compliance/staff-file-panel.tsx", import.meta.url),
      "utf8",
    );
    assert.match(panel, /Staff file/);
    assert.match(panel, /OrgPersonnelFileMatrix/);
    assert.doesNotMatch(panel, /EVV/);
    assert.doesNotMatch(panel, /HRC/);
    const filesTab = readFileSync(
      new URL("../../components/team-members/profile/file-tab.tsx", import.meta.url),
      "utf8",
    );
    // Team member file = Evidence only. No obligation reads, no overrides.
    assert.doesNotMatch(filesTab, /Record override/);
    assert.doesNotMatch(filesTab, /company_obligation|company-obligations/);
    assert.doesNotMatch(filesTab, /@\/lib\/team-members\/file/);
    assert.match(filesTab, /cellStatus/);
    assert.match(filesTab, /No evidence pack yet/);
    assert.match(filesTab, /Review evidence pack/);
    assert.match(filesTab, /Skipped \(/);
    assert.match(filesTab, /Restore/);
    assert.match(filesTab, /Send back/);
    assert.match(filesTab, /OlderRecords/);
  });

  it("deletes the leftover open-every-profile HR matrix", () => {
    const hrAdmin = readFileSync(
      new URL("../../routes/dashboard.hr-admin.tsx", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(hrAdmin, /HrComplianceMatrix/);
    assert.doesNotMatch(hrAdmin, /getHrAdminRollup/);
    assert.doesNotMatch(hrAdmin, /OtherAssignmentsRollup/);
    assert.match(hrAdmin, /redirect/);
    assert.match(hrAdmin, /\/dashboard\/team-members/);
    assert.equal(existsSync(new URL("../hr-staff.functions.ts", import.meta.url)), false);
  });

  it("prefixes a quote on formula-looking CSV cells", () => {
    assert.equal(csvCell("=cmd|'/c calc'!A0"), "\"'=cmd|'/c calc'!A0\"");
    assert.equal(csvCell("+1+1"), '"\'+1+1"');
    assert.equal(csvCell("-2"), '"\'-2"');
    assert.equal(csvCell("@sum"), '"\'@sum"');
    assert.equal(csvCell("\t=1"), '"\'\t=1"');
    assert.equal(csvCell("\r=1"), '"\'\r=1"');
    assert.equal(csvCell("Jane Doe"), '"Jane Doe"');
  });
});
