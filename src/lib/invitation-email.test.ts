import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildInvitationEmail } from "./invitation-email.ts";
import { ROLE_LABEL, roleInvitePhrase } from "./rbac.ts";

describe("role invite wording", () => {
  it("labels the stored employee role as Team member", () => {
    assert.equal(ROLE_LABEL.employee, "Team member");
  });

  it("uses a lowercase team-member phrase in the invite sentence", () => {
    assert.equal(roleInvitePhrase("employee"), "a team member");
    assert.equal(roleInvitePhrase("admin"), "an Owner");
    assert.equal(roleInvitePhrase("manager"), "a Supervisor");
    const email = buildInvitationEmail({
      orgName: "True North Supports",
      role: "employee",
      link: "https://hivecertify.com/join?invite=abc",
    });
    assert.match(
      email.html,
      /invited to join <strong>True North Supports<\/strong> as a team member/,
    );
    assert.doesNotMatch(email.html, /as a Staff|as a Team member/);
    assert.match(email.subject, /True North Supports/);
  });
});
