/**
 * Signup workspace / session copy.
 *
 * Live Auth with confirm-email returns signUp 200 + session null
 * (user_confirmation_requested). The Account step used to advance anyway.
 * Continue then called getUser() with no uid — same toast as an empty org
 * select. Split those so the real cause is visible. No PHI in messages.
 */

export const SIGNUP_CONFIRM_EMAIL_MESSAGE =
  "Confirm the email we sent, then return here to finish setup.";

export const SIGNUP_CONFIRM_CONTINUE_LABEL = "I've confirmed — continue";

export const SIGNUP_ORG_ACCESS_ERROR_MESSAGE =
  "Couldn't read your workspace (access error). Please try again.";

export const SIGNUP_TRIGGER_BLOCKED_MESSAGE =
  "Workspace create is blocked on a leftover database trigger. Apply the signup SQL handoff, then continue.";

export const SIGNUP_PROVISION_FAILED_MESSAGE =
  "We couldn't create your workspace. Please try again.";

export type SignupWorkspaceReason =
  | "no_session"
  | "org_query_error"
  | "trigger_blocked"
  | "provision_failed"
  | "not_agency_signup";

/** Account step must sit open at least this long before a real signUp. */
export const SIGNUP_MIN_FILL_MS = 3000;

/**
 * Paths that already have a destination. They must not receive a personal
 * workspace from ensureSignupWorkspace once the signup trigger stops
 * creating one.
 */
export const NON_AGENCY_SIGNUP_CREATED_VIA = [
  "invitation",
  "manual_admin",
  "training_only",
  "smart_import",
] as const;

export function signupHasSession(
  session:
    | { access_token?: string | null; user?: { id?: string | null } | null }
    | null
    | undefined,
): boolean {
  return Boolean(session?.access_token && session.user?.id);
}

export function isSignupEmailNotConfirmedError(error: unknown): boolean {
  if (error == null || typeof error !== "object") {
    return /email not confirmed/i.test(String(error ?? ""));
  }
  const row = error as { code?: unknown; message?: unknown };
  const code = String(row.code ?? "");
  const message = String(row.message ?? "");
  return code === "email_not_confirmed" || /email not confirmed/i.test(message);
}

export function messageForSignupWorkspaceReason(
  reason: SignupWorkspaceReason | null | undefined,
): string {
  switch (reason) {
    case "no_session":
      return SIGNUP_CONFIRM_EMAIL_MESSAGE;
    case "org_query_error":
      return SIGNUP_ORG_ACCESS_ERROR_MESSAGE;
    case "trigger_blocked":
      return SIGNUP_TRIGGER_BLOCKED_MESSAGE;
    case "provision_failed":
      return SIGNUP_PROVISION_FAILED_MESSAGE;
    case "not_agency_signup":
      return SIGNUP_PROVISION_FAILED_MESSAGE;
    default:
      return SIGNUP_PROVISION_FAILED_MESSAGE;
  }
}

export function userMetadataRecord(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  return meta as Record<string, unknown>;
}

export function agencyNameFromUserMetadata(meta: unknown): string {
  const raw = userMetadataRecord(meta).agency_name;
  return typeof raw === "string" ? raw.trim() : "";
}

/** Invite, manual add, roster import, training-only, and auditor logins. */
export function isBlockedSignupMeta(meta: unknown): boolean {
  const row = userMetadataRecord(meta);
  const via = typeof row.created_via === "string" ? row.created_via : "";
  if ((NON_AGENCY_SIGNUP_CREATED_VIA as readonly string[]).includes(via)) return true;
  return row.role === "auditor";
}

/**
 * Public agency signup writes agency_name into raw_user_meta_data.
 * Empty metadata is not a self-serve signup (do not invent a workspace).
 */
export function isSelfServeAgencySignup(meta: unknown): boolean {
  if (isBlockedSignupMeta(meta)) return false;
  return agencyNameFromUserMetadata(meta).length > 0;
}

export function resolveSignupWorkspaceName(opts: {
  agencyName?: string | null;
  profileAgencyName?: string | null;
  metadataAgencyName?: string | null;
  emailLocalPart?: string | null;
}): string {
  const typed = String(opts.agencyName ?? "").trim();
  const profile = String(opts.profileAgencyName ?? "").trim();
  const metadata = String(opts.metadataAgencyName ?? "").trim();
  return workspaceNameFromSignup({
    agencyName: typed || profile || metadata,
    emailLocalPart: opts.emailLocalPart,
  });
}

/**
 * Silent bot trap. A filled honeypot or a submit sooner than
 * SIGNUP_MIN_FILL_MS must look like the confirm-email success state
 * and must not call signUp.
 */
export function signupSubmissionIsAutomated(opts: {
  honeypot: string;
  mountedAtMs: number;
  submittedAtMs: number;
}): boolean {
  if (String(opts.honeypot ?? "").trim().length > 0) return true;
  if (!Number.isFinite(opts.mountedAtMs) || !Number.isFinite(opts.submittedAtMs)) return false;
  return opts.submittedAtMs - opts.mountedAtMs < SIGNUP_MIN_FILL_MS;
}

export function isOrgSetupGateError(message: string | null | undefined): boolean {
  return /agency setup is incomplete/i.test(String(message ?? ""));
}

export function isRbacSeedTriggerError(message: string | null | undefined): boolean {
  const m = String(message ?? "").toLowerCase();
  return m.includes("rbac_roles") || (m.includes("trg_seed_rbac") && m.includes("does not exist"));
}

export function workspaceNameFromSignup(opts: {
  agencyName?: string | null;
  emailLocalPart?: string | null;
}): string {
  const agency = String(opts.agencyName ?? "").trim();
  if (agency) return agency;
  const local = String(opts.emailLocalPart ?? "").trim();
  return local ? `${local}'s workspace` : "New workspace";
}
