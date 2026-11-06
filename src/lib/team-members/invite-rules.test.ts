import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  CANCEL_OWNER_INVITE_MESSAGE,
  INVITE_CANCELED_TOAST,
  NEW_ADMIN_INVITE_MESSAGE,
  OWNER_INVITE_MESSAGE,
  cancelInviteBlockedReason,
  cancelInviteQuestion,
  inviteEmailKey,
  inviteVisibleTo,
  sendInviteBlockedReason,
  withoutInvite,
  withoutPersonInvites,
} from "./invite-rules.ts";
import type { TeamInviteRow } from "./roster.ts";

const pending = (id: string, userId: string | null, email: string): TeamInviteRow => ({
  status: "pending",
  invitationId: id,
  token: `tok-${id}`,
  userId,
  name: userId ? `Person ${userId}` : null,
  email,
  accessLevel: "staff",
  presetName: null,
  createdAt: "2026-11-03T22:05:50.000Z",
  expiresAt: "2026-11-17T22:05:50.000Z",
  expired: false,
});

const notInvited = (userId: string, email: string): TeamInviteRow => ({
  status: "not_invited",
  invitationId: null,
  token: null,
  userId,
  name: `Person ${userId}`,
  email,
  accessLevel: "staff",
  presetName: null,
  createdAt: null,
  expiresAt: null,
  expired: false,
});

describe("inviteVisibleTo — the Invited view's rule, shared by list and cancel", () => {
  const base = { viewerId: "me", invitedBy: "someone-else", email: " Jo@Example.test " };

  it("agency-wide viewers see every invite", () => {
    assert.equal(inviteVisibleTo({ ...base, scope: "agency", visibleEmails: new Set() }), true);
  });

  it("scoped viewers see invites they sent", () => {
    for (const scope of ["assigned", "self"] as const) {
      assert.equal(
        inviteVisibleTo({ ...base, scope, invitedBy: "me", visibleEmails: new Set() }),
        true,
      );
    }
  });

  it("scoped viewers see invites for people they can see, emails compared trimmed and lower case", () => {
    const visibleEmails = new Set([inviteEmailKey("jo@example.test")]);
    assert.equal(inviteVisibleTo({ ...base, scope: "assigned", visibleEmails }), true);
    assert.equal(
      inviteVisibleTo({ ...base, scope: "assigned", visibleEmails: new Set(["other@x.test"]) }),
      false,
    );
    assert.equal(inviteVisibleTo({ ...base, scope: "self", visibleEmails: new Set() }), false);
  });

  it("inviteEmailKey tolerates blanks", () => {
    assert.equal(inviteEmailKey("  A@B.test "), "a@b.test");
    assert.equal(inviteEmailKey(null), "");
    assert.equal(inviteEmailKey(undefined), "");
  });
});

describe("cancelInviteBlockedReason — only an Owner cancels an invite to be an Owner", () => {
  it("blocks non-Owners on Owner invites only", () => {
    assert.equal(cancelInviteBlockedReason("owner", false), CANCEL_OWNER_INVITE_MESSAGE);
    assert.equal(cancelInviteBlockedReason("owner", true), null);
    assert.equal(cancelInviteBlockedReason("admin", false), null);
    assert.equal(cancelInviteBlockedReason("staff", false), null);
    assert.equal(cancelInviteBlockedReason(null, false), null);
  });
});

describe("sendInviteBlockedReason — Send invite and Resend", () => {
  const admin = { viewerIsOwner: false };

  it("an Owner can send or resend any invite", () => {
    for (const level of ["owner", "admin", "staff"]) {
      for (const forMember of [true, false]) {
        assert.equal(sendInviteBlockedReason({ level, forMember, viewerIsOwner: true }), null);
      }
    }
  });

  it("anyone else: never an invite to be an Owner", () => {
    assert.equal(
      sendInviteBlockedReason({ ...admin, level: "owner", forMember: true }),
      OWNER_INVITE_MESSAGE,
    );
    assert.equal(
      sendInviteBlockedReason({ ...admin, level: "owner", forMember: false }),
      OWNER_INVITE_MESSAGE,
    );
  });

  it("an Admin invite only re-sends an existing member's access; someone new needs an Owner", () => {
    assert.equal(sendInviteBlockedReason({ ...admin, level: "admin", forMember: true }), null);
    assert.equal(
      sendInviteBlockedReason({ ...admin, level: "admin", forMember: false }),
      NEW_ADMIN_INVITE_MESSAGE,
    );
  });

  it("team member invites are fine for anyone with Hire & deactivate Edit", () => {
    assert.equal(sendInviteBlockedReason({ ...admin, level: "staff", forMember: false }), null);
    assert.equal(sendInviteBlockedReason({ ...admin, level: "staff", forMember: true }), null);
    assert.equal(sendInviteBlockedReason({ ...admin, level: null, forMember: false }), null);
  });
});

describe("Uninvite dialog copy", () => {
  it("asks with the person's name, or the email when there is none", () => {
    assert.equal(
      cancelInviteQuestion({ name: "Jo Smith", email: "jo@example.test" }),
      "Cancel invite for Jo Smith?",
    );
    assert.equal(
      cancelInviteQuestion({ name: null, email: "jo@example.test" }),
      "Cancel invite for jo@example.test?",
    );
    assert.equal(
      cancelInviteQuestion({ name: "  ", email: "jo@example.test" }),
      "Cancel invite for jo@example.test?",
    );
    assert.equal(INVITE_CANCELED_TOAST, "Invite canceled.");
  });
});

describe("cached Invited list updates", () => {
  const rows = [
    pending("inv-1", "u1", "one@x.test"),
    pending("inv-2", null, "two@x.test"),
    notInvited("u3", "three@x.test"),
  ];

  it("withoutInvite removes only the canceled invite, so the Invited count drops by one", () => {
    const next = withoutInvite(rows, "inv-2");
    assert.deepEqual(
      next.map((r) => r.invitationId ?? r.userId),
      ["inv-1", "u3"],
    );
    assert.equal(rows.length, 3, "never mutates the cached array");
  });

  it("withoutPersonInvites removes every row for someone deleted or deactivated", () => {
    assert.deepEqual(
      withoutPersonInvites(rows, "u1").map((r) => r.invitationId ?? r.userId),
      ["inv-2", "u3"],
    );
    assert.deepEqual(
      withoutPersonInvites(rows, "u3").map((r) => r.invitationId ?? r.userId),
      ["inv-1", "inv-2"],
    );
    assert.equal(withoutPersonInvites(rows, "nobody").length, 3);
  });
});

describe("revokeInvitation source lock", () => {
  const src = readFileSync(new URL("./invite-cancel.functions.ts", import.meta.url), "utf8");

  it("checks Hire & deactivate Edit before the service-role client, then scope and the Owner rule", () => {
    assert.match(
      src,
      /requireCategory\(\s*supabase as unknown as Sb,\s*userId,\s*orgId,\s*"staff_hiring",\s*"edit",?\s*\)/,
    );
    assert.ok(
      src.indexOf('"staff_hiring"') <
        src.indexOf('import("@/integrations/supabase/client.server")'),
      "checks run before the service-role client is loaded",
    );
    assert.match(src, /assertCanSeeInvite\(/);
    assert.match(
      src,
      /cancelInviteBlockedReason\(invite\.access_level, access\.level === "owner"\)/,
    );
  });

  it("only flips a pending invite in this org to revoked; never .single(), never a delete", () => {
    assert.match(src, /\.update\(\{ status: "revoked" \}\)/);
    assert.match(src, /\.eq\("organization_id", orgId\)\s*\.eq\("status", "pending"\)/);
    assert.doesNotMatch(src, /\.single\(\)/);
    assert.doesNotMatch(src, /\.delete\(\)/);
    assert.match(src, /status === "accepted"\) throw new Error\(INVITE_USED_MESSAGE\)/);
  });

  it("is the only revokeInvitation", () => {
    const rail = readFileSync(new URL("./invites.functions.ts", import.meta.url), "utf8");
    assert.doesNotMatch(rail, /export const revokeInvitation/);
    assert.match(rail, /inviteVisibleTo\(/);
  });
});

describe("one visibility check for Resend and Uninvite (invite-guard.server.ts)", () => {
  it("is the Invited view's rule, from the viewer's visible members", () => {
    const guard = readFileSync(new URL("./invite-guard.server.ts", import.meta.url), "utf8");
    assert.match(guard, /export async function assertCanSeeInvite/);
    assert.match(guard, /if \(scope === "agency" \|\| invite\.invited_by === viewerId\) return;/);
    assert.match(guard, /loadVisibleMembers\(/);
    assert.match(guard, /inviteVisibleTo\(/);
  });
});

describe("Resend and Send invite source locks (work for Admins, checked on the server)", () => {
  const rail = readFileSync(new URL("./invites.functions.ts", import.meta.url), "utf8");
  const resend = rail.slice(
    rail.indexOf("export const resendInvitation"),
    rail.indexOf("async function upsertPendingInviteAndSend"),
  );
  const send = rail.slice(
    rail.indexOf("export const inviteStaffMembers"),
    rail.indexOf("export const listTeamInvites"),
  );
  const CATEGORY =
    /requireCategory\(\s*supabase as unknown as SupabaseClient,\s*userId,\s*orgId,\s*"staff_hiring",\s*"edit",?\s*\)/;
  const SERVICE_ROLE = 'import("@/integrations/supabase/client.server")';

  it("both check Hire & deactivate Edit before loading the service-role client", () => {
    for (const [name, src] of [
      ["resend", resend],
      ["send", send],
    ] as const) {
      assert.match(src, CATEGORY, name);
      assert.ok(src.search(CATEGORY) < src.indexOf(SERVICE_ROLE), `${name}: checks first`);
      assert.doesNotMatch(src, /requirePermission\(|const sb = supabase/, name);
    }
  });

  it("Resend: visible to the viewer, still pending, not for someone deactivated, Owner rules", () => {
    assert.match(resend, /assertCanSeeInvite\(/);
    assert.match(resend, /status === "accepted"\) throw new Error\(INVITE_USED_MESSAGE\)/);
    assert.match(resend, /status !== "pending"\) throw new Error\(INVITE_CANCELED_MESSAGE\)/);
    assert.match(
      resend,
      /target\?\.active === false\) throw new Error\(DEACTIVATED_INVITE_MESSAGE\)/,
    );
    assert.match(resend, /isOwner\(target\.access_level\) && !viewerIsOwner/);
    assert.match(resend, /sendInviteBlockedReason\(/);
    assert.match(resend, /sendInvitationEmail\(\{\s*supabase: admin,/);
    assert.doesNotMatch(resend, /\.single\(\)/);
  });

  it("Send invite: the member guard for each person, deactivated refused, service-role writes", () => {
    assert.match(
      send,
      /runManageMemberGuard\(\s*\{ actorId: userId, targetUserId: id, action: "invite" \},\s*guard,?\s*\)/,
    );
    assert.match(send, /refuse\(email, id, DEACTIVATED_INVITE_MESSAGE\)/);
    assert.match(send, /upsertPendingInviteAndSend\(\{\s*supabase: admin,/);
    // Only roster members: the raw `emails` input could mint an invite for an Owner's address.
    assert.doesNotMatch(send, /emails: z\.|data\.emails/);
  });
});

describe("member leaves → their invites are canceled (migration)", () => {
  const sql = readFileSync(
    new URL(
      "../../../supabase/migrations/20261104050227_invitations_revoke_when_member_leaves.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("fires when a membership is deactivated or deleted, and revokes that agency's pending invites", () => {
    assert.match(sql, /create trigger trg_member_leave_revokes_invites/);
    assert.match(sql, /after update of active, deleted_at on public\.organization_members/);
    assert.match(sql, /new\.active = false and old\.active is distinct from false/);
    assert.match(sql, /new\.deleted_at is not null and old\.deleted_at is null/);
    assert.match(sql, /set status = 'revoked'/);
    assert.match(sql, /i\.organization_id = new\.organization_id/);
    assert.match(sql, /i\.status = 'pending'/);
    assert.match(sql, /revoke all on function public\.revoke_invites_when_member_leaves\(\)/);
  });
});
