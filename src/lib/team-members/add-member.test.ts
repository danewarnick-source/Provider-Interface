import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  EMAIL_TAKEN_MESSAGE,
  OWNER_ACCESS,
  WORKER_TYPES,
  WORKER_TYPE_LABEL,
  accessNeedsOwner,
  classifyEmailMatch,
  defaultStaffPresetId,
  parseWorkerType,
  presetGroups,
  resolveAccessChoice,
  type PresetPick,
} from "./add-member.ts";

const PRESETS: Array<PresetPick & { seed_key: string | null }> = [
  { id: "p-lead", name: "Lead DSP", access_level: "staff", seed_key: "lead_dsp" },
  { id: "p-dsp", name: "DSP", access_level: "staff", seed_key: "dsp" },
  { id: "p-pm", name: "Program Manager", access_level: "admin", seed_key: "program_manager" },
  { id: "p-billing", name: "Billing", access_level: "admin", seed_key: "billing" },
];

describe("presetGroups", () => {
  it("shows Owner / Admin presets / Team member presets to an Owner", () => {
    const groups = presetGroups(PRESETS, true);
    assert.deepEqual(
      groups.map((g) => g.label),
      ["Owner", "Admin presets", "Team member presets"],
    );
    assert.deepEqual(groups[0].options, [{ value: OWNER_ACCESS, label: "Owner" }]);
    assert.deepEqual(
      groups[1].options.map((o) => o.label),
      ["Billing", "Program Manager"],
    );
    assert.deepEqual(
      groups[2].options.map((o) => o.label),
      ["DSP", "Lead DSP"],
    );
  });

  it("shows only Team member presets to anyone else", () => {
    const groups = presetGroups(PRESETS, false);
    assert.deepEqual(
      groups.map((g) => g.label),
      ["Team member presets"],
    );
  });

  it("import hides Owner but keeps Admin presets for an Owner", () => {
    const groups = presetGroups(PRESETS, true, { includeOwner: false });
    assert.deepEqual(
      groups.map((g) => g.key),
      ["admin", "staff"],
    );
  });

  it("drops empty groups", () => {
    const staffOnly = PRESETS.filter((p) => p.access_level === "staff");
    assert.deepEqual(
      presetGroups(staffOnly, true).map((g) => g.key),
      ["owner", "staff"],
    );
  });
});

describe("access from the preset", () => {
  it("derives the level; Owner has no preset", () => {
    assert.deepEqual(resolveAccessChoice(OWNER_ACCESS, PRESETS), {
      level: "owner",
      presetId: null,
    });
    assert.deepEqual(resolveAccessChoice("p-pm", PRESETS), { level: "admin", presetId: "p-pm" });
    assert.deepEqual(resolveAccessChoice("p-dsp", PRESETS), { level: "staff", presetId: "p-dsp" });
    assert.equal(resolveAccessChoice("someone-elses-preset", PRESETS), null);
  });

  it("Owner and Admin take an Owner", () => {
    assert.equal(accessNeedsOwner("owner"), true);
    assert.equal(accessNeedsOwner("admin"), true);
    assert.equal(accessNeedsOwner("staff"), false);
  });

  it("defaults to the DSP preset", () => {
    assert.equal(defaultStaffPresetId(PRESETS), "p-dsp");
    assert.equal(
      defaultStaffPresetId([{ id: "x", name: "dsp", access_level: "staff", seed_key: null }]),
      "x",
    );
    assert.equal(defaultStaffPresetId(PRESETS.filter((p) => p.access_level === "admin")), null);
  });
});

describe("classifyEmailMatch", () => {
  it("new / already here / inactive here / other agency", () => {
    assert.equal(classifyEmailMatch(null, null), "new");
    assert.equal(classifyEmailMatch("u1", true), "already_here");
    assert.equal(classifyEmailMatch("u1", false), "inactive_here");
    assert.equal(classifyEmailMatch("u1", null), "other_agency");
    assert.equal(EMAIL_TAKEN_MESSAGE, "An account with this email already exists.");
  });
});

describe("worker type", () => {
  it("is W2 / 1099 / Volunteer / Other, default W2", () => {
    assert.deepEqual([...WORKER_TYPES], ["w2", "1099", "volunteer", "other"]);
    assert.deepEqual(
      WORKER_TYPES.map((w) => WORKER_TYPE_LABEL[w]),
      ["W2", "1099", "Volunteer", "Other"],
    );
    assert.equal(parseWorkerType(""), "w2");
    assert.equal(parseWorkerType("W2 Employee"), "w2");
    assert.equal(parseWorkerType("1099 Contractor"), "1099");
    assert.equal(parseWorkerType("Volunteer"), "volunteer");
    assert.equal(parseWorkerType("intern"), "other");
  });

  it("matches the live check constraint", () => {
    const sql = readFileSync(
      new URL(
        "../../../supabase/migrations/20260928120000_team_members_profile_fields.sql",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(sql, /check \(worker_type in \('w2', '1099', 'volunteer', 'other'\)\) not valid/);
    assert.match(sql, /validate constraint profiles_worker_type_chk/);
    assert.match(sql, /transports_clients boolean not null default false/);
    assert.match(sql, /custom_attributes = custom_attributes - 'needs_setup'/);
  });
});

describe("createTeamMember source lock", () => {
  const src = readFileSync(new URL("./members.functions.ts", import.meta.url), "utf8");
  const handler = src.slice(src.indexOf("export const createTeamMember"));

  it("checks hiring edit, Owner for Owner/Admin, setup, then the exact email", () => {
    // Whitespace-free so Prettier line wrapping can't move the needles.
    const compact = handler.replace(/\s+/g, "").replace(/,\)/g, ")");
    const order = [
      'requireCategory(supabaseAdmin,context.userId,data.organizationId,"staff_hiring","edit")',
      "accessNeedsOwner(access.level)",
      "assertAgencySetupCompleteForOrg",
      "lookupEmails",
    ].map((s) => compact.indexOf(s));
    assert.ok(
      order.every((i) => i >= 0),
      String(order),
    );
    assert.deepEqual(
      [...order].sort((a, b) => a - b),
      order,
    );
    assert.match(src, /\.in\("email", wanted\)/);
    assert.doesNotMatch(src, /\.ilike\(/);
    assert.match(handler, /status: "inactive_match"/);
    assert.match(handler, /EMAIL_TAKEN_MESSAGE/);
  });

  it("writes the new fields, not the retired ones", () => {
    for (const col of [
      "date_of_birth",
      "worker_type",
      "transports_clients",
      "team_id",
      "must_change_password",
      "username",
      "staff_type_keys",
    ]) {
      assert.match(src, new RegExp(`${col}`), col);
    }
    assert.doesNotMatch(src, /custom_attributes/);
    assert.doesNotMatch(src, /requiresAbi: (true|false)|requires_abi: (true|false)/);
    assert.match(src, /"member_created"/);
    assert.match(src, /generateTempPassword\(\)/);
    assert.match(src, /sendTeamMemberInvitesInternal/);
  });

  it("import is capped and shares the same hire path", () => {
    const imp = src.slice(src.indexOf("export const importTeamMembers"));
    assert.match(imp, /\.max\(IMPORT_MAX_ROWS\)/);
    assert.match(imp, /hireTeamMemberInternal\(/);
    assert.match(src, /export const previewTeamImport/);
  });
});

describe("Smart Import uses the shared hire path unchanged", () => {
  it("calls hireTeamMemberInternal with the same flags and no client password", () => {
    const src = readFileSync(
      new URL("../smart-import-commit.functions.ts", import.meta.url),
      "utf8",
    );
    const call = src.slice(src.indexOf("await hireTeamMemberInternal("));
    const args = call.slice(0, call.indexOf('"smart_import"') + 14);
    assert.match(args, /requiresDeescalation: true/);
    assert.match(args, /requiresAbi: true/);
    assert.match(args, /staffType:/);
    assert.match(args, /"smart_import"/);
    assert.doesNotMatch(src, /temporaryPassword|temp-password|hireEmployeeInternal/);
  });
});
