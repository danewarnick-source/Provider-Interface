// Pure helpers for the team member profile page. No Supabase here — the page
// data comes from getTeamMemberProfile (profile.functions.ts) and every save
// goes through updateTeamMember (members.functions.ts).

import type { BadgeEvidenceItem } from "./badges.ts";
import type { EvidenceFileRow } from "../evidence/types.ts";
import { rowActionKeys, type RosterViewer } from "./roster.ts";

/* ------------------------------ status chip ------------------------------ */

export type MemberStatus = "active" | "inactive" | "pending_first_login" | "not_invited";

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  pending_first_login: "Pending first login",
  not_invited: "Not invited",
};

/**
 * Inactive when this agency's membership is off. Otherwise someone who has
 * never signed in is "Pending first login" once an invite exists, else
 * "Not invited". Unknown sign-in history reads as Active (never guessed down).
 */
export function memberStatus(args: {
  active: boolean;
  lastSignInAt: string | null;
  lastSignInKnown: boolean;
  hasInvite: boolean;
}): MemberStatus {
  if (!args.active) return "inactive";
  if (!args.lastSignInKnown || args.lastSignInAt) return "active";
  return args.hasInvite ? "pending_first_login" : "not_invited";
}

/** "DSP · Maple House · Pat Lee" — blanks dropped. */
export function headerSubline(parts: ReadonlyArray<string | null | undefined>): string {
  return parts
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

/* -------------------------------- ⋯ menu --------------------------------- */

export type HeaderMenuKey =
  | "review_evidence"
  | "staff_record"
  | "reset_password"
  | "send_invite"
  | "resend_invite"
  | "deactivate"
  | "reactivate";

/**
 * The header ⋯ menu, in order. Account actions follow the roster's
 * rowActionKeys (which mirror the server guards); Review evidence pack needs
 * Hire & deactivate Edit, like loadTeamMemberEvidenceFacts.
 */
export function headerMenuKeys(
  d: {
    userId: string;
    active: boolean;
    accessLevel: "owner" | "admin" | "staff";
    lastSignInAt: string | null;
    lastSignInKnown: boolean;
    pendingInviteId: string | null;
    email: string;
  },
  viewer: RosterViewer,
): HeaderMenuKey[] {
  const out: HeaderMenuKey[] = [];
  if (d.active && viewer.canCategory("staff_hiring", "edit")) out.push("review_evidence");
  out.push("staff_record");
  const account = rowActionKeys(d, viewer);
  for (const k of [
    "reset_password",
    "send_invite",
    "resend_invite",
    "deactivate",
    "reactivate",
  ] as const) {
    if (account.includes(k)) out.push(k);
  }
  return out;
}

/* ------------------------------ separation ------------------------------- */

export const SEPARATION_REASONS = ["resigned", "let_go", "contract_ended", "other"] as const;
export type SeparationReason = (typeof SEPARATION_REASONS)[number];

export const SEPARATION_REASON_LABEL: Record<SeparationReason, string> = {
  resigned: "Resigned",
  let_go: "Let go",
  contract_ended: "Contract ended",
  other: "Other",
};

/* ------------------------------ page payload ----------------------------- */

export type TeamMemberProfileData = {
  member: {
    id: string;
    userId: string;
    active: boolean;
    accessLevel: "owner" | "admin" | "staff";
    presetId: string | null;
    presetName: string | null;
    jobTitle: string | null;
    supervisorMemberId: string | null;
    supervisorName: string | null;
    endDate: string | null;
    separationReason: SeparationReason | null;
    rehireEligible: boolean | null;
  };
  profile: {
    firstName: string;
    lastName: string;
    displayName: string;
    email: string;
    username: string | null;
    phone: string | null;
    photoPath: string | null;
    homeAddress: string | null;
    emergencyContactName: string | null;
    emergencyContactRelationship: string | null;
    emergencyContactPhone: string | null;
    /** Null when the viewer may not see it (see canSeeDateOfBirth). */
    dateOfBirth: string | null;
    hireDate: string | null;
    workerType: string | null;
    transportsClients: boolean;
    staffTypeKeys: string[];
    employeeId: string | null;
    homeId: string | null;
    homeName: string | null;
  };
  status: MemberStatus;
  pendingInviteId: string | null;
  lastSignInAt: string | null;
  lastSignInKnown: boolean;
  /** Null unless the viewer has payroll View. */
  pay: { hourlyRate: number | null; dailyRate: number | null } | null;
  timeOff: Array<{ id: string; startDate: string; endDate: string; type: string; status: string }>;
  evidence: { items: BadgeEvidenceItem[]; files: EvidenceFileRow[] };
  /** userId → name, for "skipped by" and similar. */
  names: Record<string, string>;
  options: {
    homes: Array<{ id: string; name: string }>;
    supervisors: Array<{ memberId: string; name: string }>;
    staffTypes: Array<{ key: string; label: string }>;
  };
  viewer: {
    canSeeDateOfBirth: boolean;
    canEditDateOfBirth: boolean;
    canSeePay: boolean;
    canEditPay: boolean;
  };
};

export const teamMemberProfileQueryKey = (orgId: string | null | undefined, staffId: string) =>
  ["team-member-profile", orgId ?? null, staffId] as const;

/** Date of birth is visible with staff_hiring View, or to an Owner. */
export function canSeeDateOfBirth(v: { isOwner: boolean; staffHiringView: boolean }): boolean {
  return v.isOwner || v.staffHiringView;
}

/* --------------------------------- draft --------------------------------- */

export type ProfileDraft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  homeAddress: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  dateOfBirth: string;
  jobTitle: string;
  homeId: string;
  supervisorMemberId: string;
  hireDate: string;
  workerType: string;
  transportsClients: boolean;
  staffTypeKeys: string[];
  employeeId: string;
  hourlyRate: string;
  dailyRate: string;
  photoPath: string | null;
};

export function draftFromProfile(d: TeamMemberProfileData): ProfileDraft {
  const p = d.profile;
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    phone: p.phone ?? "",
    homeAddress: p.homeAddress ?? "",
    emergencyContactName: p.emergencyContactName ?? "",
    emergencyContactRelationship: p.emergencyContactRelationship ?? "",
    emergencyContactPhone: p.emergencyContactPhone ?? "",
    dateOfBirth: p.dateOfBirth ?? "",
    jobTitle: d.member.jobTitle ?? "",
    homeId: p.homeId ?? "",
    supervisorMemberId: d.member.supervisorMemberId ?? "",
    hireDate: p.hireDate ?? "",
    workerType: p.workerType ?? "w2",
    transportsClients: p.transportsClients,
    staffTypeKeys: [...p.staffTypeKeys],
    employeeId: p.employeeId ?? "",
    hourlyRate: d.pay?.hourlyRate != null ? String(d.pay.hourlyRate) : "",
    dailyRate: d.pay?.dailyRate != null ? String(d.pay.dailyRate) : "",
    photoPath: p.photoPath,
  };
}

/** The updateTeamMember fields: omitted = unchanged, null = clear. */
export type TeamMemberPatch = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  homeAddress?: string | null;
  emergencyContactName?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactPhone?: string | null;
  dateOfBirth?: string | null;
  jobTitle?: string | null;
  homeId?: string | null;
  supervisorMemberId?: string | null;
  hireDate?: string | null;
  workerType?: string;
  transportsClients?: boolean;
  staffTypeKeys?: string[];
  employeeId?: string | null;
  hourlyRate?: number | null;
  dailyRate?: number | null;
  photoPath?: string | null;
};

const orNull = (s: string): string | null => (s.trim() ? s.trim() : null);

function money(s: string): number | null | "invalid" {
  const t = s.trim().replace(/^\$/, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : "invalid";
}

/**
 * Only what changed, trimmed. Pay and date of birth are left out unless the
 * viewer may edit them, so a save never trips a permission it didn't touch.
 */
export function buildTeamMemberPatch(
  before: ProfileDraft,
  after: ProfileDraft,
  opts: { canEditPay: boolean; canEditDateOfBirth: boolean },
): TeamMemberPatch {
  const out: TeamMemberPatch = {};
  const text = <K extends keyof TeamMemberPatch & keyof ProfileDraft>(k: K, required = false) => {
    const a = String(before[k] ?? "").trim();
    const b = String(after[k] ?? "").trim();
    if (a === b) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (out as any)[k] = required ? b : orNull(b);
  };
  text("firstName", true);
  text("lastName", true);
  if (before.email.trim().toLowerCase() !== after.email.trim().toLowerCase()) {
    out.email = after.email.trim().toLowerCase();
  }
  text("phone");
  text("homeAddress");
  text("emergencyContactName");
  text("emergencyContactRelationship");
  text("emergencyContactPhone");
  if (opts.canEditDateOfBirth) text("dateOfBirth");
  text("jobTitle");
  text("homeId");
  text("supervisorMemberId");
  text("hireDate");
  text("workerType", true);
  text("employeeId");
  if (before.transportsClients !== after.transportsClients) {
    out.transportsClients = after.transportsClients;
  }
  const keysA = [...before.staffTypeKeys].sort().join("\n");
  const keysB = [...after.staffTypeKeys].sort().join("\n");
  if (keysA !== keysB) out.staffTypeKeys = [...after.staffTypeKeys];
  if (opts.canEditPay) {
    for (const k of ["hourlyRate", "dailyRate"] as const) {
      const a = money(before[k]);
      const b = money(after[k]);
      if (b === "invalid") throw new Error("Pay rates must be numbers of 0 or more.");
      if (a !== b) out[k] = b;
    }
  }
  if ((before.photoPath ?? null) !== (after.photoPath ?? null)) out.photoPath = after.photoPath;
  return out;
}

export function patchIsEmpty(p: TeamMemberPatch): boolean {
  return Object.keys(p).length === 0;
}

/* ------------------------------- username -------------------------------- */

/**
 * After an email change: someone whose username was their old email (or blank)
 * follows the new email; a chosen handle stays.
 */
export function usernameAfterEmailChange(args: {
  currentUsername: string | null;
  oldEmail: string | null;
  newEmail: string;
}): string {
  const current = (args.currentUsername ?? "").trim();
  const old = (args.oldEmail ?? "").trim().toLowerCase();
  if (!current || current.includes("@") || current.toLowerCase() === old) {
    return args.newEmail.trim().toLowerCase();
  }
  return current;
}

/* ------------------------------- time off -------------------------------- */

/** YYYY-MM-DD `days` after `today`. */
export function addDaysYmd(today: string, days: number): string {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const TIME_OFF_WINDOW_DAYS = 60;
