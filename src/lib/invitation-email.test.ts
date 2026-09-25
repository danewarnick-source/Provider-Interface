import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INVITE_EMAIL_LOGO_URL,
  buildInvitationEmail,
  inviteEmailInitials,
} from "./invitation-email.ts";
import { ROLE_LABEL, roleInvitePhrase } from "./rbac.ts";

const LINK = "https://providerinterface.com/join?invite=abc";

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
      link: LINK,
      inviterName: "Jake Probert",
    });
    assert.equal(email.subject, "Jake Probert invited you to join True North Supports");
    assert.match(email.html, /as a team member/);
    assert.match(email.text, /as a team member/);
    assert.doesNotMatch(email.html, /as a Staff|as a Team member/);
    assert.doesNotMatch(email.text, /as a Staff|as a Team member/);
  });
});

describe("centered card invite email", () => {
  const email = buildInvitationEmail({
    orgName: "True North Supports",
    role: "employee",
    link: LINK,
    inviterName: "Jake Probert",
  });

  it("is a 600px table email with the landing palette and a plain-text alternative", () => {
    assert.match(email.html, /width="600"/);
    assert.match(email.html, /role="presentation"/);
    assert.match(email.html, /#0a0f1c/);
    assert.match(email.html, /#0f182b/);
    assert.match(email.html, /#1f2b44/);
    assert.match(email.html, /#f4efe3/);
    assert.match(email.html, /#c4a35a/);
    assert.match(email.html, /bgcolor="#c4a35a"/);
    assert.match(email.html, /Iowan Old Style/);
    assert.match(email.html, /Inter,Arial/);
    assert.match(email.html, /Accept invitation/);
    assert.match(email.html, /What happens next/);
    assert.match(email.html, />Now</);
    assert.match(email.html, />Next</);
    assert.match(email.html, />Then</);
    assert.match(email.html, /Expires in 14 days/);
    assert.match(email.html, /Didn&#39;t expect this\? You can ignore it\./);
    assert.match(email.html, /One team\./);
    assert.equal(email.html.includes("hivecertify.com"), false);
    assert.equal(email.text.includes("hivecertify.com"), false);
    assert.equal(email.html.includes("data:image"), false);
    assert.equal(email.html.includes("<svg"), false);
    assert.equal(email.html.includes(LINK), true);
    assert.match(
      email.text,
      /Accept invitation: https:\/\/providerinterface\.com\/join\?invite=abc/,
    );
    assert.match(email.text, /1\. Accept the invitation \(Now\)/);
    assert.match(email.text, /2\. Set your password \(Next\)/);
    assert.match(email.text, /3\. Finish your profile \(Then\)/);
    assert.match(email.text, /Didn't expect this\? You can ignore it\./);
  });

  it("hosts the mark as a providerinterface.com PNG with alt text", () => {
    assert.equal(INVITE_EMAIL_LOGO_URL, "https://providerinterface.com/email/pi-mark.png");
    assert.match(email.html, /src="https:\/\/providerinterface\.com\/email\/pi-mark\.png"/);
    assert.match(email.html, /alt="Provider Interface"/);
    assert.equal(inviteEmailInitials("Jake Probert"), "JP");
  });

  it("keeps an Owner phrase when that role is invited", () => {
    const owner = buildInvitationEmail({
      orgName: "True North Supports",
      role: "admin",
      link: LINK,
      inviterName: "Dana",
    });
    assert.match(owner.html, /as an Owner/);
    assert.equal(owner.subject, "Dana invited you to join True North Supports");
  });

  it("falls back when the inviter or org name is blank", () => {
    const email = buildInvitationEmail({
      orgName: "  ",
      role: "employee",
      link: LINK,
      inviterName: "",
    });
    assert.equal(email.subject, "A teammate invited you to join your organization");
    assert.match(email.html, /as a team member/);
  });
});
