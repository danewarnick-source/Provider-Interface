import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  interpretInviteSendResult,
  INVITE_SEND_UNCONFIRMED,
  resendInviteToastMessage,
} from "./invite-send-result.ts";

describe("interpretInviteSendResult", () => {
  it("does not throw when the server fn returns undefined", () => {
    const out = interpretInviteSendResult(undefined);
    assert.equal(out.rpc_failure, true);
    assert.equal(out.sent, 0);
    assert.equal(out.email_sent, false);
    assert.equal(out.message, INVITE_SEND_UNCONFIRMED);
  });

  it("treats unhandled 500 as a hard failure (useServerFn does not throw)", () => {
    const out = interpretInviteSendResult({ status: 500, unhandled: true, message: "HTTPError" });
    assert.equal(out.rpc_failure, true);
    assert.equal(out.message, INVITE_SEND_UNCONFIRMED);
  });

  it("reads inviteStaffMembers { sent, results }", () => {
    const out = interpretInviteSendResult({
      sent: 1,
      skipped: 0,
      errors: 0,
      results: [{ email: "dsp@agency.org", user_id: "u1", status: "sent", reason: null }],
    });
    assert.equal(out.rpc_failure, false);
    assert.equal(out.sent, 1);
    assert.equal(out.email_sent, true);
    assert.equal(out.email, "dsp@agency.org");
    assert.match(out.message, /dsp@agency\.org/);
  });

  it("reads createInvitation / resend { email_sent, invitation }", () => {
    const out = interpretInviteSendResult({
      invitation: { id: "i1", email: "host@agency.org" },
      email_sent: true,
      email_error: null,
    });
    assert.equal(out.rpc_failure, false);
    assert.equal(out.sent, 1);
    assert.equal(out.email_sent, true);
    assert.equal(out.email, "host@agency.org");
  });

  it("surfaces created_unsent with the email error", () => {
    const out = interpretInviteSendResult({
      sent: 0,
      errors: 1,
      results: [
        {
          email: "dsp@agency.org",
          status: "created_unsent",
          reason: "RESEND_API_KEY not configured",
        },
      ],
    });
    assert.equal(out.email_sent, false);
    assert.match(out.message, /couldn't be sent/);
    assert.match(out.message, /RESEND_API_KEY/);
  });

  it("reads the unified payload that includes both sent and email_sent", () => {
    const out = interpretInviteSendResult({
      invitation: { email: "a@b.org" },
      email_sent: false,
      email_error: "No reply-to address configured",
      sent: 0,
      skipped: 0,
      errors: 1,
      results: [
        { email: "a@b.org", status: "created_unsent", reason: "No reply-to address configured" },
      ],
    });
    assert.equal(out.rpc_failure, false);
    assert.equal(out.sent, 0);
    assert.equal(out.email_error, "No reply-to address configured");
    assert.equal(out.refused, false, "the invite was saved; only the email failed");
  });

  it("refused: nobody was invited, so the reason is an error, never 'Invite saved'", () => {
    const out = interpretInviteSendResult({
      sent: 0,
      skipped: 1,
      errors: 0,
      email_sent: false,
      email_error: null,
      results: [
        {
          email: "owner@agency.org",
          user_id: "u2",
          status: "skipped",
          reason: "Only an Owner can do this to an Owner",
        },
      ],
    });
    assert.equal(out.refused, true);
    assert.equal(out.rpc_failure, false);
    assert.equal(out.email_sent, false);
    assert.equal(out.message, "Only an Owner can do this to an Owner");
  });

  it("refused covers a request that failed before anything was saved", () => {
    const out = interpretInviteSendResult({
      invitation: null,
      email_sent: false,
      email_error: "Forbidden: requires edit on staff_hiring",
      sent: 0,
      skipped: 0,
      errors: 1,
      results: [
        {
          email: "",
          user_id: null,
          status: "error",
          reason: "Forbidden: requires edit on staff_hiring",
        },
      ],
    });
    assert.equal(out.refused, true);
    assert.equal(out.message, "Forbidden: requires edit on staff_hiring");
  });

  it("not refused when anyone was invited or saved", () => {
    const sentOne = interpretInviteSendResult({
      sent: 1,
      skipped: 1,
      results: [
        { email: "a@b.org", status: "sent", reason: null },
        { email: "o@b.org", status: "skipped", reason: "Only an Owner can do this to an Owner" },
      ],
    });
    assert.equal(sentOne.refused, false);
    assert.equal(sentOne.email_sent, true);
    assert.equal(interpretInviteSendResult(undefined).refused, false, "rpc_failure covers it");
  });
});

describe("resendInviteToastMessage", () => {
  it("never reads .sent / .email_sent on a missing payload", () => {
    const toast = resendInviteToastMessage(interpretInviteSendResult(undefined));
    assert.equal(toast.tone, "error");
    assert.equal(toast.text, INVITE_SEND_UNCONFIRMED);
  });

  it("success names the recipient when present", () => {
    const toast = resendInviteToastMessage(
      interpretInviteSendResult({
        invitation: { email: "dsp@agency.org" },
        email_sent: true,
      }),
    );
    assert.equal(toast.tone, "success");
    assert.match(toast.text, /dsp@agency\.org/);
  });
});
