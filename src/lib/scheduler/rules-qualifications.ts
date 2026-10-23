// qualificationsOnDate: the ONE answer to "does this team member hold every
// qualification this shift needs, on the date of the shift?" (Decision 14).
//
// Reads only Evidence (evidence_items + evidence_files). A card counts when its
// latest file is reviewed (accepted) and does not expire before the shift's
// day. "Uploaded, waiting for review" is its own state and never clears a
// reminder (Decision 15). Reminders are warns, never blocks.
//
// The driver file (license, driving record, insurance; §1.30(2), Decision 18)
// is three Evidence items treated as one: it counts only when all three are
// reviewed and current on the shift date.
import { effectiveAttentionDate, parseIsoDate } from "../evidence/due.ts";
import { addDaysKey, dayKey } from "./time.ts";
import type { Fix, Finding, QualEvidence, QualFile, QualItem, RuleShift, StaffFacts } from "./rules-types.ts";
import { find, firstName, up } from "./rules-util.ts";

export type QualState =
  | "valid" | "grace" | "waiting_review" | "sent_back" | "expired" | "missing" | "skipped";

export type QualKind = "general" | "cpr" | "code" | "person" | "behavior" | "driver" | "window";

export type QualRequirement = {
  key: string;
  label: string;
  kind: QualKind;
  /** Days after hire a missing card is not yet a reminder. */
  graceDays?: number;
  cite?: string;
  /** Client the training is about (person-specific messages). */
  clientName?: string;
};

export type QualResult = QualRequirement & {
  state: QualState;
  /** Card expiry shown on the Evidence row, if any. */
  expiresOn: string | null;
  /** Last day of the hire grace, when state is "grace". */
  graceUntil?: string;
  message: string;
  fix?: Fix;
};

export const CPR_KEY = "cpr_first_aid";
export const CPR_GRACE_DAYS = 90;
export const BEHAVIOR_GRACE_DAYS = 180;
export const GENERAL_KEY = "thirty_day_orientation";

/** Code-specific credentials and trainings, by Evidence requirement key. */
export const CODE_QUALIFICATIONS: Readonly<Record<string, readonly QualRequirement[]>> = {
  PM1: [{ key: "pm1_lpn_license", label: "LPN license", kind: "code", cite: "§16" }],
  PM2: [{ key: "pm2_rn_license", label: "RN license", kind: "code", cite: "§17" }],
  PN1: [{ key: "pn1_nursing_license", label: "Nursing license", kind: "code", cite: "§18" }],
  PN2: [{ key: "pn2_nursing_license", label: "RN license", kind: "code", cite: "§19" }],
  BC1: [{ key: "bc1_staff_cred", label: "BC1 credential", kind: "code", cite: "§3" }],
  BC2: [{ key: "bc2_staff_cred", label: "BC2 credential", kind: "code", cite: "§4" }],
  BC3: [{ key: "bc3_staff_cred", label: "BC3 credential", kind: "code", cite: "§5" }],
  SEI: [{ key: "sei_acre", label: "ACRE certification", kind: "code", cite: "§30" }],
  SJD: [{ key: "sjd_acre", label: "ACRE certification", kind: "code", cite: "§33" }],
  SED: [{ key: "sed_acre", label: "ACRE certification", kind: "code", cite: "§28" }],
  SEE: [{ key: "see_workplace_supports_or_job_coach", label: "Workplace Supports or Job Coach training", kind: "code", cite: "§29" }],
  SEC: [{ key: "sec_coworker_orient", label: "Co-worker orientation", kind: "code", cite: "§27" }],
  CMP: [{ key: "cmp_cms_caregiver_training", label: "Caregiver training", kind: "code", cite: "§32" }],
  CMS: [{ key: "cmp_cms_caregiver_training", label: "Caregiver training", kind: "code", cite: "§32" }],
  HSQ: [{ key: "hsq_sanitary_training", label: "Clean and safe home training", kind: "code", cite: "§12" }],
  TFB: [{ key: "tfb_trainer_ready", label: "Trainer readiness", kind: "code", cite: "§36" }],
  PBA: [{ key: "pba_competency", label: "PBA competency", kind: "code", cite: "§15" }],
  HHS: [{ key: "host_home_cert", label: "Host home certification", kind: "code", cite: "§11" }],
  PPS: [{ key: "pps_foster_license", label: "Foster license", kind: "code", cite: "§20" }],
};

/** Codes whose staff may drive or transport (driver's license on file). */
export const DRIVING_CODES: ReadonlySet<string> = new Set(["MTP"]);

export type QualExtras = {
  /** Person-specific training keys for this shift's client. */
  personKeys?: readonly string[];
  clientName?: string;
  behaviorSupport?: boolean;
  hasAbi?: boolean;
  /** Shift involves driving a client. */
  driving?: boolean;
  /** Extra keys (time-window requirements). */
  extra?: readonly QualRequirement[];
};

/** Everything a shift's code (and client) asks of the staff member. */
export function requirementsFor(code: string, ex: QualExtras = {}): QualRequirement[] {
  const c = up(code);
  const out: QualRequirement[] = [
    { key: GENERAL_KEY, label: "General trainings", kind: "general", cite: "§1.8(4)" },
    { key: CPR_KEY, label: "CPR / First Aid", kind: "cpr", graceDays: CPR_GRACE_DAYS, cite: "§1.8(5)" },
    ...(CODE_QUALIFICATIONS[c] ?? []),
  ];
  for (const k of ex.personKeys ?? []) {
    out.push({ key: k, label: "Person-specific training", kind: "person", cite: "§1.8(4)", clientName: ex.clientName });
  }
  if (ex.hasAbi) out.push({ key: "abi_training", label: "ABI training", kind: "code" });
  if (ex.behaviorSupport) {
    out.push({ key: "mandt_behavior", label: "Behavior training", kind: "behavior", graceDays: BEHAVIOR_GRACE_DAYS, cite: "§1.8(6)" });
  }
  if (ex.driving || DRIVING_CODES.has(c)) {
    out.push({ key: "driver_license", label: "Driver license", kind: "driver" });
  }
  out.push(...(ex.extra ?? []));
  return out;
}

function isDone(item: QualItem, file: QualFile): boolean {
  return item.evidence_type === "attestation" ? !!file.attested_at : !!(file.storage_path || file.filename);
}

function latestFile(files: readonly QualFile[], itemId: string): QualFile | null {
  const rows = files.filter((f) => f.item_id === itemId);
  if (!rows.length) return null;
  return rows.reduce((best, row) => {
    const a = best.uploaded_at ?? best.attested_at ?? best.id ?? "";
    const b = row.uploaded_at ?? row.attested_at ?? row.id ?? "";
    return b > a ? row : best;
  });
}

/** Evidence state of one requirement key on a shift date (YYYY-MM-DD, Denver). */
export function evidenceStateOn(
  evidence: QualEvidence | undefined,
  key: string,
  onDate: string,
): { state: Exclude<QualState, "grace">; expiresOn: string | null } {
  const item = evidence?.items.find((i) => i.requirement_key === key) ?? null;
  if (!item) return { state: "missing", expiresOn: null };
  if (item.opted_out_at) return { state: "skipped", expiresOn: null };
  const file = latestFile(evidence!.files, item.id);
  if (!file) return { state: "missing", expiresOn: null };
  const expiresOn = effectiveAttentionDate({
    hasFile: true, nextDueOn: item.next_due_on, expiresOn: item.expires_on,
  });
  const review = file.review_status ?? "accepted";
  if (review === "pending") return { state: "waiting_review", expiresOn };
  if (review === "sent_back") return { state: "sent_back", expiresOn };
  if (!isDone(item, file)) return { state: "missing", expiresOn };
  const exp = parseIsoDate(expiresOn);
  if (exp && exp < onDate) return { state: "expired", expiresOn: exp };
  return { state: "valid", expiresOn: exp };
}

function evidenceFix(staff: StaffFacts, key: string, item?: QualItem | null): Fix {
  const params = new URLSearchParams({ tab: "staff", person: staff.id, item: item?.id ?? key });
  return { label: `Open ${firstName(staff.name)}'s Evidence`, href: `/dashboard/evidence?${params.toString()}` };
}

const STATE_TEXT: Record<Exclude<QualState, "valid" | "grace" | "skipped">, string> = {
  missing: "isn't on file",
  expired: "expires before this shift",
  waiting_review: "New card uploaded, waiting for review",
  sent_back: "was sent back and needs a new upload",
};

function messageFor(staff: StaffFacts, r: QualRequirement, state: QualState, expiresOn: string | null): string {
  const who = firstName(staff.name);
  if (r.kind === "person" && r.clientName && state === "missing") {
    return `${who} isn't trained for ${firstName(r.clientName)} yet (Person-specific)`;
  }
  if (state === "waiting_review") return `${who}'s ${r.label}: New card uploaded, waiting for review`;
  if (state === "expired") return `${who}'s ${r.label} expired${expiresOn ? ` on ${expiresOn}` : ""} (before this shift)`;
  if (state === "valid") return `${who}'s ${r.label} is current`;
  if (state === "grace") return `${who}'s ${r.label} is not due yet (new hire)`;
  if (state === "skipped") return `${who}'s ${r.label} was skipped`;
  return `${who}'s ${r.label} ${STATE_TEXT[state]}`;
}

/**
 * Qualification result per requirement for this staff member on the shift's
 * Denver date. Pure: pass the person's Evidence rows. The 90-day (CPR) and
 * 180-day (behavior) hire grace turn a missing card into "grace".
 */
export function qualificationsOnDate(
  staff: StaffFacts,
  shift: Pick<RuleShift, "code" | "startsAt">,
  evidence: QualEvidence | undefined,
  extras: QualExtras = {},
): QualResult[] {
  const onDate = dayKey(shift.startsAt);
  const hire = parseIsoDate(staff.hireDate);
  return requirementsFor(shift.code, extras).map((req) => {
    const base = evidenceStateOn(evidence, req.key, onDate);
    let state: QualState = base.state;
    let graceUntil: string | undefined;
    if (req.graceDays !== undefined && hire && state === "missing") {
      const until = addDaysKey(hire, req.graceDays);
      if (onDate <= until) { state = "grace"; graceUntil = until; }
    }
    const item = evidence?.items.find((i) => i.requirement_key === req.key) ?? null;
    const bad = state !== "valid" && state !== "grace" && state !== "skipped";
    return {
      ...req, state, expiresOn: base.expiresOn, ...(graceUntil ? { graceUntil } : {}),
      message: messageFor(staff, req, state, base.expiresOn),
      ...(bad ? { fix: evidenceFix(staff, req.key, item) } : {}),
    };
  });
}

/** Warn findings (Decision 15: reminders, never blocks) from qualificationsOnDate. */
export function qualificationFindings(results: readonly QualResult[]): Finding[] {
  const ruleFor: Record<QualKind, string> = {
    general: "general_training", person: "person_training", cpr: "cpr_first_aid",
    code: "code_qualification", behavior: "behavior_training", driver: "drivers_license",
    window: "window_qualification",
  };
  const out: Finding[] = [];
  for (const r of results) {
    if (r.state === "valid" || r.state === "grace" || r.state === "skipped") continue;
    const cite = r.cite ? ` (${r.cite})` : "";
    out.push(find(ruleFor[r.kind], "warn", `${r.message}${cite}`, r.fix));
  }
  return out;
}

/** The three Evidence items that make up a driver file (§1.30(2)). */
export const DRIVER_FILE_KEYS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "driver_license", label: "license" },
  { key: "driving_record", label: "driving record" },
  { key: "auto_insurance_proof", label: "insurance" },
];

/** The driver file pieces that don't count on this Denver date. Empty = complete. */
export function driverFileGaps(evidence: QualEvidence | undefined, onDate: string): Array<{ key: string; label: string; state: QualState }> {
  return DRIVER_FILE_KEYS
    .map((k) => ({ ...k, state: evidenceStateOn(evidence, k.key, onDate).state as QualState }))
    .filter((k) => k.state !== "valid");
}

export function hasDriverFile(evidence: QualEvidence | undefined, onDate: string): boolean {
  return driverFileGaps(evidence, onDate).length === 0;
}

/** Reminder for a van shift driver with no complete driver file (Decision 18: warn, never offered). */
export function driverFileFindings(staff: StaffFacts, shift: Pick<RuleShift, "startsAt">, evidence: QualEvidence | undefined): Finding[] {
  const gaps = driverFileGaps(evidence, dayKey(shift.startsAt));
  if (!gaps.length) return [];
  const who = firstName(staff.name);
  const detail = gaps.length === DRIVER_FILE_KEYS.length
    ? ""
    : `: ${gaps.map((g) => `${g.label} ${g.state === "waiting_review" ? "waiting for review" : STATE_TEXT[g.state as keyof typeof STATE_TEXT] ?? "isn't on file"}`).join(", ")}`;
  return [find("driver_file", "warn", `${who} has no driver file on record${detail} (§1.30(2))`,
    evidenceFix(staff, gaps[0]!.key, evidence?.items.find((i) => i.requirement_key === gaps[0]!.key)))];
}

/** Decision 18: a van shift is never offered to someone without a complete driver file. */
export function isOfferedTo(shift: { starts_at: string; van_route_id?: string | null }, evidence: QualEvidence | undefined): boolean {
  return !shift.van_route_id || hasDriverFile(evidence, dayKey(shift.starts_at));
}
