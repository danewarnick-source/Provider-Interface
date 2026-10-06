import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDaysYmd,
  buildTeamMemberPatch,
  canSeeDateOfBirth,
  draftFromProfile,
  headerMenuKeys,
  headerSubline,
  memberStatus,
  MEMBER_STATUS_LABEL,
  patchIsEmpty,
  SEPARATION_REASONS,
  usernameAfterEmailChange,
  type ProfileDraft,
  type TeamMemberProfileData,
} from "./profile.ts";

function data(): TeamMemberProfileData {
  return {
    member: {
      id: "m1",
      userId: "u1",
      active: true,
      accessLevel: "staff",
      presetId: "p1",
      presetName: "DSP",
      jobTitle: "DSP",
      supervisorMemberId: "m2",
      supervisorName: "Pat Lee",
      endDate: null,
      separationReason: null,
      rehireEligible: null,
    },
    profile: {
      firstName: "Jake",
      lastName: "Probert",
      displayName: "Jake Probert",
      email: "jake@example.test",
      username: "jake@example.test",
      phone: null,
      photoPath: null,
      homeAddress: "1 Main",
      emergencyContactName: null,
      emergencyContactRelationship: null,
      emergencyContactPhone: null,
      dateOfBirth: "1990-01-01",
      hireDate: "2025-01-15",
      workerType: "w2",
      transportsClients: false,
      staffTypeKeys: ["dsp"],
      employeeId: null,
      homeId: "t1",
      homeName: "Maple",
    },
    status: "active",
    pendingInviteId: null,
    lastSignInAt: null,
    lastSignInKnown: true,
    pay: { hourlyRate: 18, dailyRate: null },
    timeOff: [],
    evidence: { items: [], files: [] },
    names: {},
    options: { homes: [], supervisors: [], staffTypes: [] },
    viewer: {
      canSeeDateOfBirth: true,
      canEditDateOfBirth: true,
      canSeePay: true,
      canEditPay: true,
    },
  };
}

const ALL = { canEditPay: true, canEditDateOfBirth: true };

describe("memberStatus", () => {
  it("covers the four chips", () => {
    const base = { active: true, lastSignInAt: null, lastSignInKnown: true, hasInvite: false };
    assert.equal(memberStatus({ ...base, active: false }), "inactive");
    assert.equal(memberStatus({ ...base, lastSignInAt: "2026-09-01T00:00:00Z" }), "active");
    assert.equal(memberStatus({ ...base, hasInvite: true }), "pending_first_login");
    assert.equal(memberStatus(base), "not_invited");
    assert.equal(memberStatus({ ...base, lastSignInKnown: false }), "active");
    assert.deepEqual(Object.values(MEMBER_STATUS_LABEL), [
      "Active",
      "Inactive",
      "Pending first login",
      "Not invited",
    ]);
  });
});

describe("header helpers", () => {
  it("joins preset · home · supervisor, skipping blanks", () => {
    assert.equal(headerSubline(["DSP", "Maple", "Pat"]), "DSP · Maple · Pat");
    assert.equal(headerSubline(["DSP", null, " "]), "DSP");
    assert.equal(headerSubline([]), "");
  });

  it("date of birth: staff_hiring View or Owner", () => {
    assert.equal(canSeeDateOfBirth({ isOwner: false, staffHiringView: false }), false);
    assert.equal(canSeeDateOfBirth({ isOwner: true, staffHiringView: false }), true);
    assert.equal(canSeeDateOfBirth({ isOwner: false, staffHiringView: true }), true);
  });

  it("separation reasons match the DB check", () => {
    assert.deepEqual([...SEPARATION_REASONS], ["resigned", "let_go", "contract_ended", "other"]);
  });
});

describe("buildTeamMemberPatch", () => {
  it("is empty when nothing changed", () => {
    const d = draftFromProfile(data());
    assert.equal(patchIsEmpty(buildTeamMemberPatch(d, { ...d }, ALL)), true);
  });

  it("sends only changed fields, trimmed, blanks as null", () => {
    const before = draftFromProfile(data());
    const after: ProfileDraft = {
      ...before,
      phone: " 801-555-0100 ",
      homeAddress: "  ",
      email: "Jake.New@Example.test",
      transportsClients: true,
      staffTypeKeys: ["dsp", "lead"],
      supervisorMemberId: "",
    };
    assert.deepEqual(buildTeamMemberPatch(before, after, ALL), {
      email: "jake.new@example.test",
      phone: "801-555-0100",
      homeAddress: null,
      supervisorMemberId: null,
      transportsClients: true,
      staffTypeKeys: ["dsp", "lead"],
    });
  });

  it("ignores staff type order", () => {
    const before = { ...draftFromProfile(data()), staffTypeKeys: ["a", "b"] };
    assert.equal(
      patchIsEmpty(buildTeamMemberPatch(before, { ...before, staffTypeKeys: ["b", "a"] }, ALL)),
      true,
    );
  });

  it("pay: numbers, cleared to null, rejected when invalid, dropped without payroll edit", () => {
    const before = draftFromProfile(data());
    assert.deepEqual(
      buildTeamMemberPatch(before, { ...before, hourlyRate: "$19.5", dailyRate: "" }, ALL),
      {
        hourlyRate: 19.5,
      },
    );
    assert.deepEqual(buildTeamMemberPatch(before, { ...before, hourlyRate: "" }, ALL), {
      hourlyRate: null,
    });
    assert.throws(
      () => buildTeamMemberPatch(before, { ...before, dailyRate: "abc" }, ALL),
      /Pay rates/,
    );
    assert.deepEqual(
      buildTeamMemberPatch(before, { ...before, hourlyRate: "25" }, { ...ALL, canEditPay: false }),
      {},
    );
  });

  it("date of birth only with staff_hiring edit", () => {
    const before = draftFromProfile(data());
    const after = { ...before, dateOfBirth: "1991-02-02" };
    assert.deepEqual(buildTeamMemberPatch(before, after, ALL), { dateOfBirth: "1991-02-02" });
    assert.deepEqual(
      buildTeamMemberPatch(before, after, { ...ALL, canEditDateOfBirth: false }),
      {},
    );
  });

  it("photo path changes ride the same save", () => {
    const before = draftFromProfile(data());
    assert.deepEqual(buildTeamMemberPatch(before, { ...before, photoPath: "o/u/p.png" }, ALL), {
      photoPath: "o/u/p.png",
    });
  });
});

describe("usernameAfterEmailChange / addDaysYmd", () => {
  it("email usernames follow the new email; handles stay", () => {
    const newEmail = "New@Example.test";
    assert.equal(
      usernameAfterEmailChange({
        currentUsername: "old@example.test",
        oldEmail: "old@example.test",
        newEmail,
      }),
      "new@example.test",
    );
    assert.equal(
      usernameAfterEmailChange({ currentUsername: null, oldEmail: null, newEmail }),
      "new@example.test",
    );
    assert.equal(
      usernameAfterEmailChange({
        currentUsername: "jake_p",
        oldEmail: "old@example.test",
        newEmail,
      }),
      "jake_p",
    );
  });

  it("adds days across month ends", () => {
    assert.equal(addDaysYmd("2026-09-28", 60), "2026-11-27");
  });
});

describe("headerMenuKeys", () => {
  const person = {
    userId: "u1",
    active: true,
    accessLevel: "staff" as const,
    lastSignInAt: null,
    lastSignInKnown: true,
    pendingInviteId: null,
    email: "jake@example.test",
  };
  const admin = { userId: "me", isOwner: false, canCategory: () => true };
  const viewer = { userId: "me", isOwner: false, canCategory: () => false };

  it("hiring admins get every account action", () => {
    assert.deepEqual(headerMenuKeys(person, admin), [
      "review_evidence",
      "staff_record",
      "reset_password",
      "send_invite",
      "deactivate",
    ]);
    assert.deepEqual(headerMenuKeys({ ...person, pendingInviteId: "inv" }, admin), [
      "review_evidence",
      "staff_record",
      "reset_password",
      "resend_invite",
      "deactivate",
    ]);
  });

  it("no invite once signed in; reactivate when inactive; nothing on yourself", () => {
    assert.deepEqual(headerMenuKeys({ ...person, lastSignInAt: "2026-09-01T00:00:00Z" }, admin), [
      "review_evidence",
      "staff_record",
      "reset_password",
      "deactivate",
    ]);
    assert.deepEqual(headerMenuKeys({ ...person, active: false }, admin), [
      "staff_record",
      "reactivate",
    ]);
    assert.deepEqual(headerMenuKeys({ ...person, userId: "me", lastSignInAt: "x" }, admin), [
      "review_evidence",
      "staff_record",
    ]);
  });

  it("view-only viewers get the staff record only; Owners are Owner-only", () => {
    assert.deepEqual(headerMenuKeys(person, viewer), ["staff_record"]);
    assert.deepEqual(headerMenuKeys({ ...person, accessLevel: "owner" }, admin), [
      "review_evidence",
      "staff_record",
    ]);
  });
});
