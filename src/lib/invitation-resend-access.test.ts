import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { findMemberAccessByEmail, resolveResendAccess } from "./invitation-resend-access.ts";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const PRESET = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const members = [
  { user_id: U1, access_level: "admin", access_preset_id: PRESET },
  { user_id: U2, access_level: "owner", access_preset_id: PRESET },
];
const profiles = [
  { id: U1, email: "Dana.Lee@Agency.org" },
  { id: U2, email: "owner@agency.org" },
];

describe("findMemberAccessByEmail", () => {
  it("joins organization_members to profiles by email, case-insensitively", () => {
    assert.deepEqual(findMemberAccessByEmail("dana.lee@agency.org", members, profiles), {
      access_level: "admin",
      access_preset_id: PRESET,
    });
    assert.deepEqual(findMemberAccessByEmail("  DANA.LEE@AGENCY.ORG ", members, profiles), {
      access_level: "admin",
      access_preset_id: PRESET,
    });
  });

  it("returns null for an email that is not on the roster, or a blank email", () => {
    assert.equal(findMemberAccessByEmail("nobody@agency.org", members, profiles), null);
    assert.equal(findMemberAccessByEmail("", members, profiles), null);
    assert.equal(findMemberAccessByEmail("dana.lee@agency.org", [], profiles), null);
  });

  it("an Owner never carries a preset; an unknown level falls back to staff", () => {
    assert.deepEqual(findMemberAccessByEmail("owner@agency.org", members, profiles), {
      access_level: "owner",
      access_preset_id: null,
    });
    const odd = [{ user_id: U1, access_level: "manager", access_preset_id: PRESET }];
    assert.deepEqual(findMemberAccessByEmail("dana.lee@agency.org", odd, profiles), {
      access_level: "staff",
      access_preset_id: PRESET,
    });
  });
});

describe("resolveResendAccess", () => {
  const requested = { access_level: "staff" as const, access_preset_id: null };
  const member = { access_level: "admin" as const, access_preset_id: PRESET };

  it("explicitly requested values win over the member's current values", () => {
    assert.deepEqual(resolveResendAccess({ requested, member }), requested);
  });

  it("falls back to the member's current values so a resend never restores an old level", () => {
    assert.deepEqual(resolveResendAccess({ requested: null, member }), member);
    assert.deepEqual(resolveResendAccess({ requested: undefined, member }), member);
  });

  it("returns null when there is nothing to write (pure email invite, not on the roster yet)", () => {
    assert.equal(resolveResendAccess({ requested: null, member: null }), null);
  });
});

describe("resendInvitation source lock", () => {
  it("rewrites access_level / access_preset_id on resend and Add / Import invite with the chosen access", () => {
    const fns = readFileSync(
      new URL("./team-members/invites.functions.ts", import.meta.url),
      "utf8",
    );
    const resend = fns.slice(
      fns.indexOf("export const resendInvitation"),
      fns.indexOf("export const revokeInvitation"),
    );
    assert.match(resend, /resolveResendAccess\(/);
    assert.match(resend, /findMemberAccessByEmail\(/);
    assert.match(resend, /assertCanInviteAt\(/);
    assert.match(resend, /status: "pending", \.\.\.\(access \?\? \{\}\)/);
    assert.doesNotMatch(resend, /update\(\{ expires_at: expires, status: "pending" \}\)/);
    // organization_members ↔ profiles share no FK: two queries, never an embed.
    assert.doesNotMatch(resend, /profiles\s*\(/);

    // Add / Import invite through sendTeamMemberInvitesInternal, which updates a
    // pending invite with the access just chosen (never the older row's access).
    const upsert = fns.slice(fns.indexOf("async function upsertPendingInviteAndSend"));
    assert.match(upsert, /update\(\{ expires_at: expires, \.\.\.access \}\)/);
    const team = fns.slice(fns.indexOf("export async function sendTeamMemberInvitesInternal"));
    assert.match(team, /level: t\.level,\s+presetId: t\.presetId/);
  });
});
