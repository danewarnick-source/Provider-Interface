import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  SIGNUP_CONFIRM_CONTINUE_LABEL,
  SIGNUP_CONFIRM_EMAIL_MESSAGE,
  SIGNUP_MIN_FILL_MS,
  isBlockedSignupMeta,
  isOrgSetupGateError,
  isRbacSeedTriggerError,
  isSelfServeAgencySignup,
  isSignupEmailNotConfirmedError,
  messageForSignupWorkspaceReason,
  resolveSignupWorkspaceName,
  signupHasSession,
  signupSubmissionIsAutomated,
  workspaceNameFromSignup,
} from "./signup-workspace.ts";

describe("signup workspace / session", () => {
  it("requires a real session (access token + user id)", () => {
    assert.equal(signupHasSession(null), false);
    assert.equal(signupHasSession({ access_token: "tok", user: null }), false);
    assert.equal(signupHasSession({ access_token: "tok", user: { id: "u1" } }), true);
  });

  it("detects email_not_confirmed so Account can stay on the confirm sentence", () => {
    assert.equal(isSignupEmailNotConfirmedError({ code: "email_not_confirmed" }), true);
    assert.equal(isSignupEmailNotConfirmedError({ message: "Email not confirmed" }), true);
    assert.equal(isSignupEmailNotConfirmedError({ code: "invalid_credentials" }), false);
    assert.match(SIGNUP_CONFIRM_CONTINUE_LABEL, /confirmed/i);
  });

  it("splits no-session copy from org / trigger failures", () => {
    assert.equal(messageForSignupWorkspaceReason("no_session"), SIGNUP_CONFIRM_EMAIL_MESSAGE);
    assert.match(messageForSignupWorkspaceReason("org_query_error"), /access error/i);
    assert.match(messageForSignupWorkspaceReason("trigger_blocked"), /sql handoff/i);
    assert.doesNotMatch(messageForSignupWorkspaceReason("no_session"), /workspace isn't ready/i);
  });

  it("detects the live rbac_roles seed-trigger failure", () => {
    assert.equal(
      isRbacSeedTriggerError('handle_new_user failed: relation "public.rbac_roles" does not exist'),
      true,
    );
    assert.equal(isRbacSeedTriggerError("permission denied for table organizations"), false);
  });

  it("names the workspace from the agency, not True North", () => {
    assert.equal(workspaceNameFromSignup({ agencyName: "Sunrise Supports" }), "Sunrise Supports");
    assert.equal(
      workspaceNameFromSignup({ emailLocalPart: "danewarnick+pi1" }),
      "danewarnick+pi1's workspace",
    );
    assert.doesNotMatch(workspaceNameFromSignup({ agencyName: "Test agency 1" }), /True North/i);
  });

  it("signup workspace provision no longer calls the legacy role_permissions seed", () => {
    const src = readFileSync(new URL("./signup-workspace.functions.ts", import.meta.url), "utf8");
    assert.doesNotMatch(src, /seed_org_role_permissions/);
    assert.match(src, /access_level:\s*"owner"/);
  });

  it("defaults the owner profile username to the signup email", () => {
    const src = readFileSync(new URL("./signup-workspace.functions.ts", import.meta.url), "utf8");
    assert.match(src, /defaultUsernameFromEmail/);
    assert.match(src, /username:\s*defaultUsernameFromEmail/);
  });

  it("names a later confirm from auth metadata before the email placeholder", () => {
    assert.equal(
      resolveSignupWorkspaceName({
        metadataAgencyName: "Sunrise Supports",
        emailLocalPart: "ada",
      }),
      "Sunrise Supports",
    );
    assert.equal(
      resolveSignupWorkspaceName({
        agencyName: "Typed on this device",
        metadataAgencyName: "Sunrise Supports",
        emailLocalPart: "ada",
      }),
      "Typed on this device",
    );
    assert.equal(
      resolveSignupWorkspaceName({
        profileAgencyName: "From the profile",
        metadataAgencyName: "Sunrise Supports",
        emailLocalPart: "ada",
      }),
      "From the profile",
    );
    assert.equal(resolveSignupWorkspaceName({ emailLocalPart: "ada" }), "ada's workspace");
  });

  it("does not treat invite, manual, training, or auditor metadata as an agency signup", () => {
    assert.equal(isSelfServeAgencySignup({ agency_name: "Sunrise Supports" }), true);
    assert.equal(isSelfServeAgencySignup({}), false);
    assert.equal(isBlockedSignupMeta({ created_via: "invitation" }), true);
    assert.equal(isBlockedSignupMeta({ created_via: "manual_admin" }), true);
    assert.equal(isBlockedSignupMeta({ created_via: "training_only" }), true);
    assert.equal(isBlockedSignupMeta({ created_via: "smart_import" }), true);
    assert.equal(isBlockedSignupMeta({ role: "auditor", agency_name: "State" }), true);
    assert.equal(
      isSelfServeAgencySignup({ created_via: "invitation", agency_name: "Nope" }),
      false,
    );
  });

  it("treats a filled honeypot or a sub-3s submit as automated", () => {
    const mounted = 1_000;
    assert.equal(
      signupSubmissionIsAutomated({
        honeypot: "",
        mountedAtMs: mounted,
        submittedAtMs: mounted + SIGNUP_MIN_FILL_MS,
      }),
      false,
    );
    assert.equal(
      signupSubmissionIsAutomated({
        honeypot: "",
        mountedAtMs: mounted,
        submittedAtMs: mounted + SIGNUP_MIN_FILL_MS - 1,
      }),
      true,
    );
    assert.equal(
      signupSubmissionIsAutomated({
        honeypot: "https://spam.example",
        mountedAtMs: mounted,
        submittedAtMs: mounted + 30_000,
      }),
      true,
    );
  });

  it("recognizes the agency-setup gate error without treating it as the rbac seed failure", () => {
    const gate =
      "Agency setup is incomplete. Answer the required operating questions before creating staff or clients.";
    assert.equal(isOrgSetupGateError(gate), true);
    assert.equal(isRbacSeedTriggerError(gate), false);
  });

  it("inserts the owner with the service role and reads agency_name from auth metadata", () => {
    const src = readFileSync(new URL("./signup-workspace.functions.ts", import.meta.url), "utf8");
    assert.match(src, /supabaseAdmin/);
    assert.match(src, /from\("organization_members"\)\.insert/);
    assert.match(src, /access_level:\s*"owner"/);
    assert.match(src, /getUserById/);
    assert.match(src, /agencyNameFromUserMetadata/);
    assert.match(src, /isSelfServeAgencySignup/);
    assert.match(src, /trg_org_members_require_org_setup/);
    const signup = readFileSync(new URL("../../routes/signup.tsx", import.meta.url), "utf8");
    const trap = signup.indexOf("signupSubmissionIsAutomated");
    const signUp = signup.indexOf("supabase.auth.signUp");
    assert.ok(trap !== -1 && signUp !== -1 && trap < signUp);
    assert.match(signup, /name="company_website"/);
    assert.match(signup, /autoComplete="off"/);
    assert.match(signup, /tabIndex=\{-1\}/);
    assert.match(signup, /aria-hidden="true"/);
    assert.doesNotMatch(signup, /name="company_website"[\s\S]{0,200}type="hidden"/);
    const adapter = readFileSync(new URL(".././aws/auth-adapter.ts", import.meta.url), "utf8");
    assert.equal(adapter.split("async signUp(").length - 1, 2);
  });

  it("invite, manual add, and training-only write their own rows", () => {
    const invite = readFileSync(new URL("./join-invite.functions.ts", import.meta.url), "utf8");
    assert.match(invite, /created_via: "invitation"/);
    assert.match(invite, /from\("profiles"\)/);
    const join = readFileSync(new URL("../../routes/join.tsx", import.meta.url), "utf8");
    assert.match(join, /accept_invitation/);
    const hire = readFileSync(new URL("../staff/employees.functions.ts", import.meta.url), "utf8");
    assert.match(hire, /created_via: createdVia/);
    assert.match(hire, /from\("organization_members"\)\.upsert/);
    const training = readFileSync(
      new URL("../training/training-only-exec.functions.ts", import.meta.url),
      "utf8",
    );
    assert.match(training, /created_via: "training_only"/);
    assert.doesNotMatch(training, /from\("organizations"\)\.insert/);
    const login = readFileSync(new URL("../../routes/login.tsx", import.meta.url), "utf8");
    assert.match(login, /ensureSignupWorkspace/);
    const root = readFileSync(new URL("../../routes/__root.tsx", import.meta.url), "utf8");
    assert.match(root, /ensureSignupWorkspace/);
  });
});
