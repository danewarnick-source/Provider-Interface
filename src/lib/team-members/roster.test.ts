import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { EvidenceFileRow, EvidenceItemRow } from "../evidence/types.ts";
import {
  EMPTY_EVIDENCE,
  ROSTER_CSV_HEADER,
  baseRosterRows,
  buildTeamInviteRows,
  evidenceLabel,
  evidencePercent,
  filterByViewerScope,
  filterRosterRows,
  isInviteExpired,
  missingInfoFor,
  missingInfoText,
  parseRosterFilter,
  parseRosterSort,
  positionSummary,
  resolvePositions,
  rosterCsv,
  rosterCsvFileName,
  rosterFilterCounts,
  rosterJobLine,
  rosterPickOptions,
  rosterPositionOptions,
  rosterQueryIsNarrowed,
  rosterQueryKey,
  rosterViewCounts,
  rowActionKeys,
  serializeRosterSort,
  sortRosterRows,
  summarizeEvidence,
  teamInvitesQueryKey,
  toggleRosterFilter,
  toggleRosterSort,
  type InviteSourceMember,
  type RosterEvidenceSummary,
  type RosterRow,
  type RosterViewer,
  countEmployeesOnRosterTab,
  filterEmployeesByRosterTab,
  formatLastLogin,
  formatRosterDate,
  isEmployeeOnActiveRoster,
  lastLoginByUserId,
} from "./roster.ts";

const active = { active: true, profile: { account_status: "active", is_active: true } };
const deactivated = { active: false, profile: { account_status: "active", is_active: true } };
const archived = { active: false, profile: { account_status: "archived", is_active: false } };
const archivedStillFlaggedActive = {
  active: true,
  profile: { account_status: "archived", is_active: true },
};
const profileInactive = { active: true, profile: { account_status: "active", is_active: false } };

describe("isEmployeeOnActiveRoster", () => {
  it("keeps only operational active members on Active", () => {
    assert.equal(isEmployeeOnActiveRoster(active), true);
    assert.equal(isEmployeeOnActiveRoster({ active: true, profile: null }), true);
    assert.equal(isEmployeeOnActiveRoster(deactivated), false);
    assert.equal(isEmployeeOnActiveRoster(archived), false);
    assert.equal(isEmployeeOnActiveRoster(archivedStillFlaggedActive), false);
    assert.equal(isEmployeeOnActiveRoster(profileInactive), false);
  });

  it("never mixes deactivated or archived into the Active list", () => {
    const roster = [active, deactivated, archived, archivedStillFlaggedActive, profileInactive];
    assert.deepEqual(filterEmployeesByRosterTab(roster, "active"), [active]);
    assert.equal(countEmployeesOnRosterTab(roster, "active"), 1);
    assert.equal(countEmployeesOnRosterTab(roster, "inactive"), 4);
    for (const m of filterEmployeesByRosterTab(roster, "inactive")) {
      assert.equal(isEmployeeOnActiveRoster(m), false);
    }
  });
});

describe("Add team member dialog source lock", () => {
  it("is one person on one screen with DSPD fields, an optional invite, then Evidence", () => {
    const src = readFileSync(
      new URL("../../components/team-members/add/add-member-dialog.tsx", import.meta.url),
      "utf8",
    );
    for (const label of [
      "First name",
      "Last name",
      "Email (for sign-in)",
      "Phone",
      "Hire date",
      "Position",
      "Access",
      "Home",
      "Supervisor",
      "Date of birth",
      "Transports clients",
      "Worker type",
      "Email an invite now",
      "Add team member",
      "Review evidence pack",
      "Open profile",
      "Add another",
      "used to work here. Reactivate instead?",
    ]) {
      assert.ok(src.includes(label), label);
    }
    assert.match(src, /Invite sent to \$\{email\}/);
    assert.match(src, /What they can see and do in PI/);
    assert.match(src, /createTeamMember/);
    assert.match(src, /reactivateMember/);
    // Gone: multi-person cards, the second invite screen, the old Evidence link,
    // org-configured fields and hardcoded staff types, client-side passwords.
    for (const gone of [
      /Add another team member/,
      /Send invites\?/,
      /wizard=1/,
      /Set up Evidence pack/,
      /Your organization's fields/,
      /drives training requirements/,
      /feature_config/,
      /staff-fields-panel/,
      /lib\/temp-password/,
      /generateTempPassword/,
      /site_origin/,
      /createEmployeeManually/,
      /newStaffId/,
      /finish\(true\)/,
      /Job title/,
      /requiresAbi|requiresDeescalation/,
    ]) {
      assert.doesNotMatch(src, gone, String(gone));
    }
    // User-facing wording is "team member".
    assert.doesNotMatch(src, /employee/i);
    assert.doesNotMatch(src, /[\u{1F300}-\u{1FAFF}]/u);
  });
});

describe("Team roster page source lock", () => {
  const roster = (f: string) =>
    readFileSync(new URL(`../../components/team-members/roster/${f}`, import.meta.url), "utf8");
  const ROSTER_FILES = [
    "team-roster-page.tsx",
    "roster-header.tsx",
    "roster-toolbar.tsx",
    "roster-filter-buttons.tsx",
    "roster-table.tsx",
    "roster-cards.tsx",
    "row-actions.tsx",
    "invites-view.tsx",
    "inactive-view.tsx",
    "evidence-status.tsx",
    "use-roster-actions.tsx",
  ];

  it("loads through one server call — no browser queries, no hive_executives, no Platform admin", () => {
    const src = roster("team-roster-page.tsx");
    assert.match(src, /export function TeamRosterPage/);
    assert.match(src, /getRouteApi\("\/dashboard\/team-members\/"\)/);
    assert.match(src, /listTeamRoster/);
    assert.match(src, /listTeamInvites/);
    assert.doesNotMatch(src, /createFileRoute|RequirePermission/);
    for (const f of ROSTER_FILES) {
      const file = roster(f);
      assert.doesNotMatch(file, /integrations\/supabase\/client"/, `${f} has no browser Supabase`);
      assert.doesNotMatch(file, /\.from\(|\.rpc\(/, `${f} runs no queries`);
      assert.doesNotMatch(file, /hive_executives|Platform admin/, f);
      assert.doesNotMatch(file, /window\.confirm|\bconfirm\(/, `${f} uses the app's dialogs`);
      assert.doesNotMatch(file, /delete[E]ntity|Delete permanently/, `${f} has no hard delete`);
      // User-facing wording is "team member": no JSX text or prose string says employee.
      assert.doesNotMatch(file, />[^<>{}]*\bemployees?\b[^<>{}]*</i, f);
      assert.doesNotMatch(file, /["`][^"`]*\s[^"`]*\bemployees?\b[^"`]*["`]/i, f);
      assert.doesNotMatch(file, /company_obligation/, f);
      assert.doesNotMatch(file, /[\u{1F300}-\u{1FAFF}]/u, f);
      const lines = file.trimEnd().split("\n").length;
      assert.ok(lines <= 250, `${f} stays under ~250 lines (has ${lines})`);
    }
  });

  it("header: counts, Add (primary) before Import, both gated on staff_hiring Edit, ghost Export", () => {
    const src = roster("roster-header.tsx");
    assert.match(src, /Team Members/);
    assert.match(src, /active · \{counts\.inactive\} inactive · \{counts\.invited\} invited/);
    assert.match(src, /canCategory\("staff_hiring", "edit"\)/);
    assert.match(src, /\{canHire && <AddTeamMemberButton/);
    assert.match(src, /\{canHire && \(\s*<ImportTeamMembersButton/);
    assert.ok(src.indexOf("<AddTeamMemberButton") < src.indexOf("<ImportTeamMembersButton"));
    assert.match(src, /variant="ghost"[\s\S]*Export CSV/);
    assert.match(src, /rosterCsvFileName\(\)/);
    assert.match(src, /<ReviewEvidencePackDialog/);
    assert.match(src, /onReviewEvidence=\{setReviewIds\}/);
    assert.doesNotMatch(src, /FinishEmployeeSetupWizard|Finish setup/);
  });

  it("table: the new columns, sortable headers, and the old Login/Status/Caseload are gone", () => {
    const src = roster("roster-table.tsx");
    for (const col of ["Position", "Home · Supervisor", "Start date", "Last login"]) {
      assert.match(src, new RegExp(col));
    }
    // No preset name anywhere on the roster; Owner / Admin is a badge by the name.
    for (const f of ROSTER_FILES) {
      assert.doesNotMatch(roster(f), /presetName|Full access|>Preset<|"Preset"/, f);
    }
    assert.match(src, /<LevelTag level=\{r\.accessLevel\} \/>\s*\{r\.mustChangePassword/);
    assert.match(src, /MissingInfoChip/);
    assert.match(src, /missingInfoText/);
    for (const key of ["name", "evidence", "start", "login"]) {
      assert.match(src, new RegExp(`sortKey="${key}"`));
    }
    assert.match(src, /Pending first login/);
    assert.doesNotMatch(src, /Needs setup|NeedsSetupChip/);
    assert.match(src, /EvidenceBar/);
    assert.doesNotMatch(src, />Login</);
    assert.doesNotMatch(src, />Status</);
    for (const f of ROSTER_FILES) {
      assert.doesNotMatch(roster(f), /CaseloadDrawer|Caseload Assignment Center/, f);
    }
    assert.match(roster("evidence-status.tsx"), /No pack yet/);
    assert.match(roster("evidence-status.tsx"), /search=\{\{ tab: "file" \}\}/);
  });

  it("row actions: labels, profile tabs, and own-dialog confirms", () => {
    const actions = roster("row-actions.tsx");
    for (const label of [
      "Open profile",
      "Review evidence pack",
      "Edit caseload",
      "Reset password…",
      "Send invite",
      "Resend invite",
      "Deactivate…",
      "Reactivate",
    ]) {
      assert.match(actions, new RegExp(label));
    }
    assert.match(actions, /side="bottom"/);
    const hook = roster("use-roster-actions.tsx");
    assert.match(hook, /tab: "file"/);
    assert.match(hook, /tab: "caseload"/);
    assert.match(hook, /DeactivateDialog/);
    assert.match(hook, /ResetPasswordDialog/);
    assert.match(hook, /deactivateMember/);
    assert.match(hook, /reactivateMember/);
  });

  it("invites view: per-row busy, awaited clipboard, AlertDialog uninvite, expiry badge", () => {
    const src = roster("invites-view.tsx");
    assert.match(src, /function InviteRowItem/);
    assert.match(src, /useMutation/);
    assert.match(src, /await navigator\.clipboard\.writeText/);
    assert.match(src, /toast\.error\("Couldn't copy the invite link/);
    assert.match(src, /AlertDialog/);
    assert.match(src, /Expired/);
    assert.match(src, /resendInvitation/);
    assert.match(src, /revokeInvitation/);
    assert.match(src, /Send invite/);
    assert.match(src, /Account created — no invite email sent/);
    assert.doesNotMatch(src, /Not invited yet/);
    // Send invite is the primary button (no outline variant).
    assert.match(
      src,
      /<Button size="sm" disabled=\{busy\} onClick=\{\(\) => act\.mutate\("send"\)\}>/,
    );
  });

  it("filters: one at a time, solid when on, disabled with a reason at 0", () => {
    const src = roster("roster-filter-buttons.tsx");
    assert.match(src, /toggleRosterFilter\(filter, f\)/);
    assert.match(src, /bg-primary text-primary-foreground/);
    assert.match(src, /disabled=\{empty\}/);
    assert.match(src, /ROSTER_FILTER_EMPTY\[f\]/);
    const toolbar = roster("roster-toolbar.tsx");
    assert.match(toolbar, /label="Position"/);
    assert.match(toolbar, /\{showHome && \(/);
    assert.doesNotMatch(toolbar, /label="Preset"/);
    const page = roster("team-roster-page.tsx");
    assert.match(page, /Showing \{visible\.length\} of \{viewTotal\}/);
    assert.match(page, /Clear filter/);
    assert.match(page, /rememberRosterSearch\(search\)/);
  });

  it("reset password: server-generated, shown once, roster invalidated, no browser generator", () => {
    const src = readFileSync(
      new URL("../../components/team-members/dialogs/reset-password-dialog.tsx", import.meta.url),
      "utf8",
    );
    assert.match(src, /resetMemberPassword/);
    assert.match(src, /rosterQueryKey/);
    assert.match(src, /shown only once/);
    assert.match(src, /label="Login"/);
    assert.doesNotMatch(src, /generateTempPassword/);
    for (const f of ROSTER_FILES) assert.doesNotMatch(roster(f), /generateTempPassword/, f);
  });

  it("roster.functions.ts: category + scope checks first, no embeds, no role, Evidence only", () => {
    const src = readFileSync(new URL("./roster.functions.ts", import.meta.url), "utf8");
    assert.match(src, /requireCategory\(supabase as Sb, userId, orgId, "staff_roster", "view"\)/);
    assert.match(src, /filterByViewerScope/);
    assert.match(src, /rpc\("access_can_see_staff"/);
    assert.match(src, /rpc\("org_member_last_sign_ins"/);
    assert.match(src, /from\("evidence_items"\)/);
    assert.match(src, /from\("evidence_files"\)/);
    assert.match(src, /\.eq\("subject_type", "staff"\)/);
    assert.doesNotMatch(src, /company_obligation/);
    assert.doesNotMatch(src, /select\([^)]*\brole\b/);
    assert.doesNotMatch(src, /profiles\(|organization_members\(/, "no PostgREST embeds");
    assert.ok(
      src.indexOf('"staff_roster", "view"') < src.indexOf("client.server"),
      "checks run before the service-role client is loaded",
    );
    const invites = readFileSync(new URL("./invites.functions.ts", import.meta.url), "utf8");
    const fn = invites.slice(invites.indexOf("export const listTeamInvites"));
    assert.match(fn, /"staff_hiring",\s*"view"/);
    assert.match(fn, /buildTeamInviteRows/);
  });
});

describe("formatRosterDate / formatLastLogin", () => {
  it("matches Start date style and distinguishes Never from unknown", () => {
    assert.equal(formatRosterDate(null), "—");
    assert.equal(formatRosterDate("not-a-date"), "—");
    assert.equal(formatRosterDate("2024-02-05T12:00:00.000Z"), "Feb 5, 2024");
    assert.equal(formatLastLogin(undefined, false), "—");
    assert.equal(formatLastLogin(null, true), "Never");
    assert.equal(formatLastLogin("2026-08-27T12:00:00.000Z", true), "Aug 27, 2026");
  });

  it("reads a bare YYYY-MM-DD as a local calendar day, so the roster matches the profile hire date", () => {
    // new Date("2025-01-15") is midnight UTC, which is still Jan 14 in Denver —
    // the old behavior showed a day earlier than the profile. Node applies a
    // runtime TZ change to subsequent Date operations, so pin Denver here.
    const previousTz = process.env.TZ;
    process.env.TZ = "America/Denver";
    try {
      assert.equal(formatRosterDate("2025-01-15"), "Jan 15, 2025");
      assert.equal(formatRosterDate("2024-12-31"), "Dec 31, 2024");
      assert.equal(formatRosterDate(" 2025-07-04 "), "Jul 4, 2025");
    } finally {
      if (previousTz === undefined) delete process.env.TZ;
      else process.env.TZ = previousTz;
    }
  });
});

describe("lastLoginByUserId", () => {
  it("maps Core RPC rows and ignores junk", () => {
    const map = lastLoginByUserId([
      { user_id: "u1", last_sign_in_at: "2026-08-27T00:00:00.000Z" },
      { user_id: "u2", last_sign_in_at: null },
      { user_id: "", last_sign_in_at: "2026-01-01T00:00:00.000Z" },
      { last_sign_in_at: "2026-01-01T00:00:00.000Z" },
      null,
    ]);
    assert.equal(map.get("u1"), "2026-08-27T00:00:00.000Z");
    assert.equal(map.get("u2"), null);
    assert.equal(map.has("u2"), true);
    assert.equal(map.size, 2);
    assert.equal(lastLoginByUserId(null).size, 0);
    assert.equal(lastLoginByUserId("nope").size, 0);
  });
});

describe("Finish setup is gone", () => {
  it("has no dialog, server fn, roster chip, or needs_setup flag", () => {
    const at = (rel: string) => new URL(rel, import.meta.url);
    assert.equal(
      existsSync(at("../../components/team-members/add/finish-setup-dialog.tsx")),
      false,
    );
    assert.equal(existsSync(at("../../components/hr/staff-fields-panel.tsx")), false);
    const hire = readFileSync(at("./members.functions.ts"), "utf8");
    const rosterLib = readFileSync(at("./roster.ts"), "utf8");
    const rosterFns = readFileSync(at("./roster.functions.ts"), "utf8");
    const header = readFileSync(
      at("../../components/team-members/roster/roster-header.tsx"),
      "utf8",
    );
    for (const gone of [
      /finishEmployeeSetup/,
      /applyEmployeeRosterRow/,
      /createEmployeeManually/,
      /hireEmployeeInternal/,
      /needs_?[sS]etup/,
      /deferHirePack/,
      /feature_config/,
    ]) {
      assert.doesNotMatch(hire, gone, String(gone));
    }
    for (const src of [rosterLib, rosterFns, header]) {
      assert.doesNotMatch(src, /needs_?[sS]etup|NeedsSetup|Finish setup/);
    }
    assert.match(hire, /onStaffHiredInternal\(supabaseAdmin, data\.organizationId, newUserId\)/);
    assert.doesNotMatch(hire, /\.ilike\(/);
    assert.match(hire, /\.eq\("email", effectiveEmail\)/);
    assert.doesNotMatch(hire, /add_and_update/);
    assert.doesNotMatch(hire, /update_only/);
  });
});

/* ------------------------------------------------------------------------- */
/* listTeamRoster summaries and the roster toolbar                            */
/* ------------------------------------------------------------------------- */

const TODAY = "2026-09-28";

function evItem(partial: Partial<EvidenceItemRow> & { opted_out_at?: string | null }) {
  return {
    id: "i1",
    organization_id: "org",
    subject_type: "staff",
    subject_id: "u1",
    requirement_key: "cpr_first_aid",
    title: "CPR",
    evidence_type: "upload",
    attestation_text: null,
    cadence: "every_2_years",
    sow_cite: null,
    suggested: true,
    sent_to_staff: false,
    visible_to_staff_id: null,
    dual_link_key: null,
    dual_link_peer_id: null,
    expires_on: null,
    first_due_rule: "set_date",
    first_due_on: null,
    document_date: null,
    next_due_on: null,
    renew_years: null,
    send_message: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  } as EvidenceItemRow & { opted_out_at?: string | null };
}

function evFile(partial: Partial<EvidenceFileRow> & { review_status?: string | null }) {
  return {
    id: "f1",
    organization_id: "org",
    item_id: "i1",
    storage_path: "org/i1/cpr.pdf",
    filename: "cpr.pdf",
    attested_at: null,
    attested_by: null,
    attestation_text_snapshot: null,
    uploaded_by: null,
    uploaded_at: "2026-09-01T00:00:00Z",
    notes: null,
    ...partial,
  } as EvidenceFileRow & { review_status?: string | null };
}

describe("summarizeEvidence", () => {
  it("counts done / missing / due soon with the Evidence page's own rules", () => {
    const items = [
      evItem({ id: "done-far", next_due_on: "2027-06-01" }),
      evItem({ id: "done-soon", next_due_on: "2026-10-10" }),
      evItem({ id: "past", next_due_on: "2026-09-01" }),
      evItem({ id: "nofile-soon", first_due_on: "2026-10-20" }),
      evItem({ id: "nofile-later", first_due_on: "2026-12-31" }),
    ];
    const files = [
      evFile({ id: "a", item_id: "done-far" }),
      evFile({ id: "b", item_id: "done-soon" }),
      evFile({ id: "c", item_id: "past" }),
    ];
    const s = summarizeEvidence(items, files, TODAY);
    assert.deepEqual(s, {
      hasPack: true,
      total: 5,
      done: 2,
      dueSoon: 2,
      missing: 3,
      awaitingReview: 0,
      skipped: 0,
    });
  });

  it("due soon is inclusive of today and today + 30, never past due", () => {
    const s = summarizeEvidence(
      [
        evItem({ id: "today", first_due_on: TODAY }),
        evItem({ id: "edge", first_due_on: "2026-10-28" }),
        evItem({ id: "beyond", first_due_on: "2026-10-29" }),
        evItem({ id: "yesterday", first_due_on: "2026-09-27" }),
      ],
      [],
      TODAY,
    );
    assert.equal(s.dueSoon, 2);
    assert.equal(s.missing, 4);
  });

  it("attestations count as done only once attested", () => {
    const item = evItem({ id: "att", evidence_type: "attestation" });
    assert.equal(summarizeEvidence([item], [evFile({ item_id: "att" })], TODAY).done, 0);
    assert.equal(
      summarizeEvidence(
        [item],
        [evFile({ item_id: "att", attested_at: "2026-09-02T00:00:00Z" })],
        TODAY,
      ).done,
      1,
    );
  });

  it("awaiting review reads only the latest file; missing column counts 0", () => {
    const items = [evItem({ id: "r" })];
    const older = evFile({
      id: "old",
      item_id: "r",
      uploaded_at: "2026-08-01T00:00:00Z",
      review_status: "pending",
    });
    const newer = evFile({
      id: "new",
      item_id: "r",
      uploaded_at: "2026-09-10T00:00:00Z",
      review_status: "pending",
    });
    assert.equal(summarizeEvidence(items, [older, newer], TODAY).awaitingReview, 1);
    const approved = { ...newer, review_status: "approved" };
    assert.equal(summarizeEvidence(items, [older, approved], TODAY).awaitingReview, 0);
    assert.equal(summarizeEvidence(items, [evFile({ item_id: "r" })], TODAY).awaitingReview, 0);
  });

  it("skipped items are excluded from every other count but still mean a pack exists", () => {
    const s = summarizeEvidence(
      [evItem({ id: "s1", opted_out_at: "2026-09-01T00:00:00Z" }), evItem({ id: "m" })],
      [],
      TODAY,
    );
    assert.deepEqual(s, {
      hasPack: true,
      total: 1,
      done: 0,
      dueSoon: 0,
      missing: 1,
      awaitingReview: 0,
      skipped: 1,
    });
    const onlySkipped = summarizeEvidence(
      [evItem({ opted_out_at: "2026-09-01T00:00:00Z" })],
      [],
      TODAY,
    );
    assert.equal(onlySkipped.hasPack, true);
    assert.equal(onlySkipped.total, 0);
    assert.deepEqual(summarizeEvidence([], [], TODAY), EMPTY_EVIDENCE);
  });
});

describe("evidenceLabel / evidencePercent", () => {
  const sum = (p: Partial<RosterEvidenceSummary>): RosterEvidenceSummary => ({
    ...EMPTY_EVIDENCE,
    hasPack: true,
    ...p,
  });
  it("No pack yet, then missing, awaiting review, due soon, all current", () => {
    assert.deepEqual(evidenceLabel(EMPTY_EVIDENCE), { kind: "no_pack", text: "No pack yet" });
    assert.equal(
      evidenceLabel(sum({ total: 3, missing: 2, awaitingReview: 1, dueSoon: 1 })).text,
      "2 missing",
    );
    assert.equal(
      evidenceLabel(sum({ total: 3, done: 3, awaitingReview: 1, dueSoon: 1 })).text,
      "1 awaiting review",
    );
    assert.equal(evidenceLabel(sum({ total: 3, done: 3, dueSoon: 2 })).text, "2 due soon");
    assert.equal(evidenceLabel(sum({ total: 3, done: 3 })).text, "All current");
  });
  it("bar is share on file; an all-skipped pack is full, no pack is empty", () => {
    assert.equal(evidencePercent(sum({ total: 4, done: 1 })), 25);
    assert.equal(evidencePercent(sum({ total: 0, skipped: 2 })), 100);
    assert.equal(evidencePercent(EMPTY_EVIDENCE), 0);
  });
});

describe("missingInfoFor", () => {
  it("flags hire date, date of birth, address and emergency contact", () => {
    assert.deepEqual(missingInfoFor(null), [
      "hire_date",
      "date_of_birth",
      "address",
      "emergency_contact",
    ]);
    assert.deepEqual(
      missingInfoFor({
        start_date: "2025-01-15",
        date_of_birth: "1990-02-03",
        home_address: "1 Main St",
        emergency_contact_name: "Pat",
        emergency_contact_phone: "555-0100",
      }),
      [],
    );
    assert.deepEqual(
      missingInfoFor({
        hire_date: "2025-01-15",
        date_of_birth: "1990-02-03",
        home_address: "  ",
        emergency_contact_name: "Pat",
        emergency_contact_phone: "",
      }),
      ["address", "emergency_contact"],
    );
  });
});

describe("rosterJobLine", () => {
  it("hides old role names", () => {
    assert.equal(rosterJobLine("DSP"), "DSP");
    assert.equal(rosterJobLine("Program Manager"), null);
    assert.equal(rosterJobLine(null, "Coach"), "Coach");
    assert.equal(rosterJobLine("  "), null);
  });
});

function row(p: Partial<RosterRow>): RosterRow {
  return {
    userId: "u",
    memberId: "m",
    displayName: "Pat Lee",
    firstName: "Pat",
    lastName: "Lee",
    email: "pat@example.test",
    phone: "",
    employeeId: "",
    photoPath: null,
    jobTitle: null,
    accessLevel: "staff",
    positions: [{ key: "dsp", label: "Direct Support Professional" }],
    homeId: null,
    homeName: null,
    supervisorId: null,
    supervisorName: null,
    hireDate: null,
    active: true,
    mustChangePassword: false,
    lastSignInAt: "2026-09-01T00:00:00Z",
    lastSignInKnown: true,
    pendingInviteId: null,
    evidence: { ...EMPTY_EVIDENCE, hasPack: true, total: 1, done: 1 },
    missingInfo: [],
    ...p,
  };
}

const ROWS: RosterRow[] = [
  row({
    userId: "a",
    memberId: "ma",
    displayName: "Alex Kim",
    email: "alex@x.test",
    employeeId: "TM-7",
    homeId: "h1",
    homeName: "Maple",
    hireDate: "2024-03-01",
    lastSignInAt: "2026-09-20T00:00:00Z",
  }),
  row({
    userId: "b",
    memberId: "mb",
    displayName: "blake Stone",
    evidence: EMPTY_EVIDENCE,
    hireDate: "2025-01-01",
    lastSignInAt: null,
    missingInfo: ["address"],
  }),
  row({
    userId: "c",
    memberId: "mc",
    displayName: "Casey Oak",
    evidence: { ...EMPTY_EVIDENCE, hasPack: true, total: 2, missing: 1, dueSoon: 1 },
    supervisorId: "a",
    supervisorName: "Alex Kim",
    positions: [
      { key: "operations_director", label: "Operations Director" },
      { key: "dsp", label: "Direct Support Professional" },
      { key: "hhp", label: "Host Home Provider" },
    ],
    accessLevel: "admin",
  }),
  row({ userId: "d", memberId: "md", displayName: "Dana Pine", active: false }),
];

describe("roster toolbar: search, filters, dropdowns, counts", () => {
  it("search matches name, email and team member ID, case-insensitively", () => {
    const names = (q: string) => baseRosterRows(ROWS, { view: "active", q }).map((r) => r.userId);
    assert.deepEqual(names("BLAKE"), ["b"]);
    assert.deepEqual(names("alex@x"), ["a"]);
    assert.deepEqual(names("tm-7"), ["a"]);
    assert.deepEqual(names(""), ["a", "b", "c"]);
  });

  it("Active and Inactive never mix", () => {
    assert.deepEqual(
      baseRosterRows(ROWS, { view: "inactive" }).map((r) => r.userId),
      ["d"],
    );
    assert.deepEqual(rosterViewCounts(ROWS), { active: 3, inactive: 1 });
  });

  it("one filter at a time; old comma lists keep the first valid key; counts follow the rest of the toolbar", () => {
    assert.equal(parseRosterFilter("missing"), "missing");
    assert.equal(parseRosterFilter("bogus,expiring,missing"), "expiring");
    assert.equal(parseRosterFilter("bogus"), null);
    assert.equal(parseRosterFilter(undefined), null);
    assert.equal(toggleRosterFilter(null, "missing"), "missing");
    assert.equal(toggleRosterFilter("missing", "review"), "review");
    assert.equal(toggleRosterFilter("review", "review"), null);
    const f = (filter: ReturnType<typeof parseRosterFilter>) =>
      filterRosterRows(ROWS, { view: "active", filter }).map((r) => r.userId);
    assert.deepEqual(f(null), ["a", "b", "c"]);
    assert.deepEqual(f("no_pack"), ["b"]);
    assert.deepEqual(f("missing"), ["c"]);
    assert.deepEqual(f("missing_info"), ["b"]);
    assert.deepEqual(f("review"), []);
    assert.deepEqual(rosterFilterCounts(baseRosterRows(ROWS, { view: "active" })), {
      no_pack: 1,
      expiring: 1,
      missing: 1,
      review: 0,
      missing_info: 1,
    });
  });

  it("Position / Home / Supervisor dropdowns; 'none' finds people with nothing set", () => {
    const pick = (q: Partial<Parameters<typeof baseRosterRows>[1]>) =>
      baseRosterRows(ROWS, { view: "active", ...q }).map((r) => r.userId);
    assert.deepEqual(pick({ home: "h1" }), ["a"]);
    assert.deepEqual(pick({ home: "none" }), ["b", "c"]);
    assert.deepEqual(pick({ position: "hhp" }), ["c"]);
    assert.deepEqual(pick({ position: "dsp" }), ["a", "b", "c"]);
    assert.deepEqual(pick({ position: "none" }), []);
    assert.deepEqual(rosterPositionOptions([...ROWS, row({ userId: "e", positions: [] })]), [
      { value: "dsp", label: "Direct Support Professional" },
      { value: "hhp", label: "Host Home Provider" },
      { value: "operations_director", label: "Operations Director" },
      { value: "none", label: "None" },
    ]);
    assert.deepEqual(pick({ supervisor: "a" }), ["c"]);
    assert.deepEqual(
      rosterPickOptions(
        ROWS,
        (r) => r.homeId,
        (r) => r.homeName,
      ),
      [
        { value: "h1", label: "Maple" },
        { value: "none", label: "None" },
      ],
    );
  });
});

describe("roster positions, missing info, Showing X of Y", () => {
  const TYPES = [
    { key: "dsp", label: "Direct Support Professional" },
    { key: "executive_director", label: "Executive Director" },
  ];

  it("resolves staff_type_keys by key, then label (Add dialog saves labels), then slug", () => {
    assert.deepEqual(resolvePositions(["dsp", "Executive Director"], TYPES), TYPES);
    // Same position saved both ways collapses to one.
    assert.deepEqual(resolvePositions(["executive_director", "Executive Director"], TYPES), [
      TYPES[1],
    ]);
    assert.deepEqual(resolvePositions(["DSP", " ", "Night Owl"], TYPES), [
      TYPES[0],
      { key: "night_owl", label: "Night Owl" },
    ]);
    assert.deepEqual(resolvePositions(null, TYPES), []);
  });

  it("shows up to two positions, then +N", () => {
    const c = ROWS[2]!;
    assert.deepEqual(positionSummary(c.positions), {
      shown: ["Operations Director", "Direct Support Professional"],
      more: 1,
    });
    assert.deepEqual(positionSummary([]), { shown: [], more: 0 });
  });

  it("Missing info hover lists what's missing, in order", () => {
    assert.equal(
      missingInfoText(["emergency_contact", "date_of_birth"]),
      "Date of birth, emergency contact",
    );
    assert.equal(missingInfoText([]), "");
  });

  it("any filter, search or dropdown counts as narrowed", () => {
    assert.equal(rosterQueryIsNarrowed({ view: "active" }), false);
    assert.equal(rosterQueryIsNarrowed({ view: "active", q: "  " }), false);
    assert.equal(rosterQueryIsNarrowed({ view: "active", filter: "missing" }), true);
    assert.equal(rosterQueryIsNarrowed({ view: "active", q: "pat" }), true);
    assert.equal(rosterQueryIsNarrowed({ view: "active", position: "dsp" }), true);
    assert.equal(rosterQueryIsNarrowed({ view: "inactive", home: "none" }), true);
  });
});

describe("roster sort", () => {
  it("parses, serializes and toggles the URL value", () => {
    assert.deepEqual(parseRosterSort(undefined), { key: "name", desc: false });
    assert.deepEqual(parseRosterSort("-login"), { key: "login", desc: true });
    assert.deepEqual(parseRosterSort("role"), { key: "name", desc: false });
    assert.equal(serializeRosterSort({ key: "name", desc: false }), undefined);
    assert.equal(serializeRosterSort({ key: "start", desc: true }), "-start");
    assert.deepEqual(toggleRosterSort({ key: "start", desc: false }, "start"), {
      key: "start",
      desc: true,
    });
    assert.deepEqual(toggleRosterSort({ key: "start", desc: true }, "evidence"), {
      key: "evidence",
      desc: false,
    });
  });

  it("sorts by name, start date, last login (blanks last) and evidence (worst first)", () => {
    const active = ROWS.slice(0, 3);
    const ids = (key: "name" | "start" | "login" | "evidence", desc = false) =>
      sortRosterRows(active, { key, desc }).map((r) => r.userId);
    assert.deepEqual(ids("name"), ["a", "b", "c"]);
    assert.deepEqual(ids("name", true), ["c", "b", "a"]);
    assert.deepEqual(ids("start"), ["a", "b", "c"]);
    assert.deepEqual(ids("start", true), ["b", "a", "c"]);
    assert.deepEqual(ids("login"), ["c", "a", "b"]);
    assert.deepEqual(ids("login", true), ["a", "c", "b"]);
    assert.deepEqual(ids("evidence"), ["b", "c", "a"]);
    assert.deepEqual(ids("evidence", true), ["a", "c", "b"]);
  });
});

describe("rosterCsv", () => {
  it("writes the spec columns, formula-safe, one row per filtered person", () => {
    const csv = rosterCsv([
      row({
        displayName: "=HYPERLINK(1)",
        phone: "555",
        homeName: "Maple",
        supervisorName: "Alex",
        hireDate: "2025-01-15",
      }),
      row({
        displayName: "Owner Person",
        accessLevel: "owner",
        positions: [],
        lastSignInAt: null,
        active: false,
      }),
      row({ displayName: "Unknown", lastSignInKnown: false }),
    ]);
    const lines = csv.split("\r\n");
    assert.equal(lines.length, 4);
    assert.equal(lines[0], ROSTER_CSV_HEADER.map((h) => `"${h}"`).join(","));
    assert.deepEqual(
      [...ROSTER_CSV_HEADER],
      [
        "Name",
        "Email",
        "Phone",
        "Position",
        "Access",
        "Home",
        "Supervisor",
        "Start date",
        "Last login",
        "Evidence status",
        "Status",
      ],
    );
    assert.doesNotMatch(lines[1]!, /^"=/);
    assert.match(
      lines[1]!,
      /"Direct Support Professional","Team member","Maple","Alex","2025-01-15","2026-09-01","All current","Active"$/,
    );
    assert.match(lines[2]!, /"","Owner","","","","Never","All current","Inactive"$/);
    assert.match(lines[3]!, /"","All current","Active"$/);
  });

  it("names the file team-members-YYYY-MM-DD.csv", () => {
    assert.equal(rosterCsvFileName(new Date(2026, 8, 5, 12)), "team-members-2026-09-05.csv");
  });
});

describe("rowActionKeys", () => {
  const viewer = (
    over: Partial<RosterViewer> & { cats?: Record<string, "view" | "edit"> } = {},
  ): RosterViewer => {
    const cats = over.cats ?? {
      staff_roster: "edit",
      staff_hiring: "edit",
      staff_compliance: "view",
    };
    return {
      userId: over.userId ?? "me",
      isOwner: over.isOwner ?? false,
      canCategory: (id, min) => {
        const v = cats[id];
        return min === "view" ? v === "view" || v === "edit" : v === "edit";
      },
    };
  };

  it("active row, full access: every item in order; Send vs Resend only when never signed in", () => {
    assert.deepEqual(rowActionKeys(row({ userId: "x" }), viewer()), [
      "open",
      "evidence",
      "caseload",
      "reset_password",
      "deactivate",
    ]);
    assert.deepEqual(rowActionKeys(row({ userId: "x", lastSignInAt: null }), viewer()), [
      "open",
      "evidence",
      "caseload",
      "reset_password",
      "send_invite",
      "deactivate",
    ]);
    assert.deepEqual(
      rowActionKeys(row({ userId: "x", lastSignInAt: null, pendingInviteId: "inv" }), viewer()),
      ["open", "evidence", "caseload", "reset_password", "resend_invite", "deactivate"],
    );
    // Unknown sign-in (lookup failed) never offers an invite.
    assert.ok(
      !rowActionKeys(
        row({ userId: "x", lastSignInAt: null, lastSignInKnown: false }),
        viewer(),
      ).includes("send_invite"),
    );
  });

  it("hides Reset and Deactivate on your own row", () => {
    const keys = rowActionKeys(row({ userId: "me" }), viewer());
    assert.ok(!keys.includes("reset_password"));
    assert.ok(!keys.includes("deactivate"));
  });

  it("only an Owner acts on an Owner; view-only viewers get Open (and Evidence if allowed)", () => {
    assert.deepEqual(rowActionKeys(row({ userId: "o", accessLevel: "owner" }), viewer()), [
      "open",
      "evidence",
      "caseload",
    ]);
    assert.ok(
      rowActionKeys(row({ userId: "o", accessLevel: "owner" }), viewer({ isOwner: true })).includes(
        "deactivate",
      ),
    );
    assert.deepEqual(
      rowActionKeys(row({ userId: "x" }), viewer({ cats: { staff_roster: "view" } })),
      ["open"],
    );
  });

  it("inactive rows: Open profile, plus Reactivate with Hire & deactivate Edit", () => {
    assert.deepEqual(rowActionKeys(row({ userId: "x", active: false }), viewer()), [
      "open",
      "reactivate",
    ]);
    assert.deepEqual(
      rowActionKeys(
        row({ userId: "x", active: false }),
        viewer({ cats: { staff_roster: "view", staff_hiring: "view" } }),
      ),
      ["open"],
    );
  });
});

describe("filterByViewerScope", () => {
  it("agency sees everyone, self only themselves, assigned asks access_can_see_staff", async () => {
    const ids = ["me", "a", "b"];
    const asked: string[] = [];
    const canSee = async (id: string) => {
      asked.push(id);
      return id !== "b";
    };
    assert.deepEqual(
      await filterByViewerScope({ scope: "agency", viewerId: "me", userIds: ids, canSee }),
      ids,
    );
    assert.deepEqual(
      await filterByViewerScope({ scope: "self", viewerId: "me", userIds: ids, canSee }),
      ["me"],
    );
    assert.deepEqual(asked, []);
    assert.deepEqual(
      await filterByViewerScope({ scope: "assigned", viewerId: "me", userIds: ids, canSee }),
      ["me", "a"],
    );
    assert.deepEqual(asked.sort(), ["a", "b", "me"]);
  });
});

describe("Invited view rows", () => {
  const NOW = Date.parse("2026-09-28T12:00:00Z");
  const member = (p: Partial<InviteSourceMember>): InviteSourceMember => ({
    userId: "u",
    email: "u@x.test",
    name: "U",
    accessLevel: "staff",
    presetId: null,
    createdAt: "2026-09-01T00:00:00Z",
    active: true,
    lastSignInAt: null,
    lastSignInKnown: true,
    ...p,
  });

  it("isInviteExpired", () => {
    assert.equal(isInviteExpired("2026-09-27T00:00:00Z", NOW), true);
    assert.equal(isInviteExpired("2026-10-10T00:00:00Z", NOW), false);
    assert.equal(isInviteExpired(null, NOW), false);
    assert.equal(isInviteExpired("garbage", NOW), false);
  });

  it("pending invites newest first with preset + expiry, then never-signed-in members without one", () => {
    const rows = buildTeamInviteRows({
      invitations: [
        {
          id: "i-old",
          token: "t1",
          email: "Pending@X.test",
          access_level: "staff",
          access_preset_id: "p1",
          created_at: "2026-09-01T00:00:00Z",
          expires_at: "2026-09-15T00:00:00Z",
        },
        {
          id: "i-new",
          token: "t2",
          email: "fresh@x.test",
          access_level: "admin",
          access_preset_id: null,
          created_at: "2026-09-20T00:00:00Z",
          expires_at: "2026-10-04T00:00:00Z",
        },
      ],
      members: [
        member({ userId: "p", email: "pending@x.test", name: "Pending Person" }),
        member({ userId: "n", email: "never@x.test", name: "Never Invited", presetId: "p1" }),
        member({ userId: "s", email: "signed@x.test", lastSignInAt: "2026-09-02T00:00:00Z" }),
        member({ userId: "i", email: "inactive@x.test", active: false }),
        member({ userId: "k", email: "unknown@x.test", lastSignInKnown: false }),
        member({ userId: "e", email: "" }),
      ],
      presetNames: new Map([["p1", "DSP"]]),
      nowMs: NOW,
    });
    assert.deepEqual(
      rows.map((r) => [r.status, r.invitationId ?? r.userId, r.expired, r.presetName, r.name]),
      [
        ["pending", "i-new", false, null, null],
        ["pending", "i-old", true, "DSP", "Pending Person"],
        ["not_invited", "n", false, "DSP", "Never Invited"],
      ],
    );
    assert.equal(rows[0]!.accessLevel, "admin");
  });
});

describe("query keys", () => {
  it("sit under the prefixes the Add / Import dialogs invalidate", () => {
    assert.deepEqual(rosterQueryKey("o").slice(0, 1), ["members"]);
    assert.deepEqual(teamInvitesQueryKey("o").slice(0, 1), ["invites"]);
    assert.notDeepEqual(rosterQueryKey("o"), ["members", "o"]);
  });
});

describe("roster return search (profile back buttons)", () => {
  it("profile: tabs replace history; the back link goes to the remembered roster", () => {
    const page = readFileSync(
      new URL("../../components/team-members/profile/profile-page.tsx", import.meta.url),
      "utf8",
    );
    const header = readFileSync(
      new URL("../../components/team-members/profile/profile-header.tsx", import.meta.url),
      "utf8",
    );
    for (const src of [page, header]) assert.doesNotMatch(src, /history\.back|history\.go\(/);
    assert.match(page, /replace: true,\s*search: \(prev\) => \(\{\s*\.\.\.prev,\s*tab:/);
    assert.match(header, /const backSearch = lastRosterSearch\(\)/);
    const backs = header.match(/<Link to="\/dashboard\/team-members" search=\{backSearch\}/g) ?? [];
    assert.equal(backs.length, 1);
  });

  it("remembers view/filter/search/dropdowns/sort, drops dialog flags, defaults to {}", async () => {
    const { lastRosterSearch, rememberRosterSearch } = await import("./roster-return.ts");
    assert.deepEqual(lastRosterSearch(), {});
    rememberRosterSearch({
      view: "inactive",
      filter: "missing",
      q: "pat",
      position: "dsp",
      sort: "-start",
      add: "1",
      import: "1",
      home: "",
    });
    assert.deepEqual(lastRosterSearch(), {
      view: "inactive",
      filter: "missing",
      q: "pat",
      position: "dsp",
      sort: "-start",
    });
    rememberRosterSearch({});
    assert.deepEqual(lastRosterSearch(), {});
  });
});
