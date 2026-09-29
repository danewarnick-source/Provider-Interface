// Can this team member work alone with this client? Pure: reads only the
// person's Evidence rows (through the same helpers as the profile badges),
// their hire date, the client's flags and person-specific training
// completion. Readiness warns; it never blocks a save or a shift.
//
// One set of rules. The caseload tab and rankStaffForShift both call
// staffClientReadiness — never re-state these rules elsewhere.

import { addDaysYmd } from "./profile.ts";
import { evidenceItemDone, formatLocalDate, type BadgeEvidenceItem } from "./badges.ts";
import { parseIsoDate } from "../evidence/due.ts";
import type { EvidenceFileRow } from "../evidence/types.ts";

export const ORIENTATION_KEY = "thirty_day_orientation";
export const ABI_KEY = "abi_training";
export const CPR_KEY = "cpr_first_aid";
export const BEHAVIOR_KEY = "mandt_behavior";

/** Days after hire before CPR / First Aid must be on file. */
export const CPR_GRACE_DAYS = 90;
/** Days after hire before behavior intervention certification must be on file. */
export const BEHAVIOR_GRACE_DAYS = 180;

export type ReadinessRule = "orientation" | "person_training" | "abi" | "cpr" | "behavior";

export const READINESS_LABEL: Record<ReadinessRule, string> = {
  orientation: "30-day orientation",
  person_training: "Person-specific training",
  abi: "ABI training",
  cpr: "CPR",
  behavior: "Behavior certification",
};

export type ReadinessStatus = "ready" | "ready_with_deadline" | "not_ready";

export type ReadinessMissing = { rule: ReadinessRule; label: string };
export type ReadinessDeadline = { rule: ReadinessRule; label: string; dueBy: string };
export type ReadinessSkipped = {
  rule: ReadinessRule;
  label: string;
  /** Who skipped it; null when unknown. */
  skippedBy: string | null;
};

export type Readiness = {
  status: ReadinessStatus;
  missing: ReadinessMissing[];
  deadlines: ReadinessDeadline[];
  skipped: ReadinessSkipped[];
};

export type ReadinessInput = {
  /** YYYY-MM-DD (Denver). */
  today: string;
  /** profiles.hire_date (or start_date), YYYY-MM-DD. */
  hireDate: string | null;
  /** The person's Evidence rows (subject 'staff'). */
  evidence: {
    items: readonly BadgeEvidenceItem[];
    files: readonly EvidenceFileRow[];
  };
  client: {
    /** clients.has_abi */
    hasAbi: boolean;
    /** Client in behavior_support_clients or with client_target_behaviors. */
    behaviorSupport: boolean;
  };
  /** Person-specific training for THIS client. */
  personTraining: {
    /** Published client_specific_trainings ids for the client. */
    requiredIds: readonly string[];
    /** Current training_completions (topic_kind 'person') ref_ids for this person. */
    completedIds: ReadonlySet<string> | readonly string[];
  };
  nameOf?: (userId: string) => string | null;
};

type RuleCheck =
  | { kind: "ok" }
  | { kind: "missing" }
  | { kind: "deadline"; dueBy: string }
  | { kind: "skipped"; by: string | null };

function evidenceRule(
  input: ReadinessInput,
  requirementKey: string,
  graceDays: number | null,
): RuleCheck {
  const { items, files } = input.evidence;
  const item = items.find((i) => i.requirement_key === requirementKey) ?? null;
  if (item?.opted_out_at) {
    const by = item.opted_out_by ? (input.nameOf?.(item.opted_out_by) ?? null) : null;
    return { kind: "skipped", by };
  }
  if (evidenceItemDone(items, files, requirementKey, input.today)) return { kind: "ok" };
  if (graceDays !== null) {
    const hire = parseIsoDate(input.hireDate);
    if (hire) {
      const dueBy = addDaysYmd(hire, graceDays);
      if (input.today < dueBy) return { kind: "deadline", dueBy };
    }
  }
  return { kind: "missing" };
}

function personTrainingRule(input: ReadinessInput): RuleCheck {
  const required = input.personTraining.requiredIds;
  if (!required.length) return { kind: "ok" };
  const done =
    input.personTraining.completedIds instanceof Set
      ? input.personTraining.completedIds
      : new Set(input.personTraining.completedIds as readonly string[]);
  return required.every((id) => done.has(id)) ? { kind: "ok" } : { kind: "missing" };
}

/**
 * Rules:
 *   30-day orientation done.
 *   Person-specific training for this client done (when the client has one published).
 *   Client has ABI → ABI training done.
 *   CPR / First Aid done, or hired less than 90 days ago (→ deadline).
 *   Client has behavior support → behavior certification done, or hired less
 *     than 180 days ago (→ deadline).
 * A rule whose Evidence item was skipped reports "skipped by {name}", never missing.
 */
export function staffClientReadiness(input: ReadinessInput): Readiness {
  const checks: Array<[ReadinessRule, RuleCheck]> = [
    ["orientation", evidenceRule(input, ORIENTATION_KEY, null)],
    ["person_training", personTrainingRule(input)],
  ];
  if (input.client.hasAbi) checks.push(["abi", evidenceRule(input, ABI_KEY, null)]);
  checks.push(["cpr", evidenceRule(input, CPR_KEY, CPR_GRACE_DAYS)]);
  if (input.client.behaviorSupport) {
    checks.push(["behavior", evidenceRule(input, BEHAVIOR_KEY, BEHAVIOR_GRACE_DAYS)]);
  }

  const out: Readiness = { status: "ready", missing: [], deadlines: [], skipped: [] };
  for (const [rule, check] of checks) {
    const label = READINESS_LABEL[rule];
    if (check.kind === "missing") out.missing.push({ rule, label });
    else if (check.kind === "deadline") out.deadlines.push({ rule, label, dueBy: check.dueBy });
    else if (check.kind === "skipped") out.skipped.push({ rule, label, skippedBy: check.by });
  }
  out.status = out.missing.length
    ? "not_ready"
    : out.deadlines.length
      ? "ready_with_deadline"
      : "ready";
  return out;
}

export type ReadinessBadgeTone = "ok" | "warn" | "bad" | "muted";

/**
 * One badge per client:
 *   "Not ready: {missing}"            (bad)
 *   "{item} skipped by {name}"        (muted)
 *   "Ready — CPR due by {date}"       (warn)
 *   "Ready"                           (ok)
 */
export function readinessBadge(r: Readiness): { label: string; tone: ReadinessBadgeTone } {
  if (r.status === "not_ready") {
    return { label: `Not ready: ${r.missing.map((m) => m.label).join(", ")}`, tone: "bad" };
  }
  if (r.skipped.length) {
    const label = r.skipped
      .map((s) => (s.skippedBy ? `${s.label} skipped by ${s.skippedBy}` : `${s.label} skipped`))
      .join(", ");
    return { label, tone: "muted" };
  }
  if (r.status === "ready_with_deadline") {
    const dues = r.deadlines
      .map((d) => `${d.label} due by ${formatLocalDate(d.dueBy) || d.dueBy}`)
      .join(", ");
    return { label: `Ready — ${dues}`, tone: "warn" };
  }
  return { label: "Ready", tone: "ok" };
}

/** Counts ready and ready-with-deadline as ready to work alone. */
export function isReadyAlone(r: Readiness): boolean {
  return r.status !== "not_ready";
}

/** "Ready alone: x of y clients" — null when there is no caseload. */
export function readyAloneLabel(readiness: readonly Readiness[]): string | null {
  if (!readiness.length) return null;
  const ready = readiness.filter(isReadyAlone).length;
  return `Ready alone: ${ready} of ${readiness.length} client${readiness.length === 1 ? "" : "s"}`;
}

/**
 * Scheduler warning chips for one staff × client. Same rules as the caseload
 * badge; the picker never blocks on readiness.
 */
export function readinessWarnings(r: Readiness): string[] {
  const out: string[] = [];
  if (r.missing.length) out.push(`Not ready: ${r.missing.map((m) => m.label).join(", ")}`);
  for (const d of r.deadlines) out.push(`${d.label} due by ${d.dueBy}`);
  return out;
}

/**
 * Qualification keys the readiness CPR rule already covers. rankStaffForShift
 * drops these from its per-code cert list so CPR is checked once.
 */
export function isCprQualificationKey(key: string): boolean {
  const k = key.trim().toLowerCase();
  return (
    k === "cpr-fa" ||
    k.endsWith(":cpr-fa") ||
    k.endsWith(":cpr_first_aid") ||
    k.endsWith(":cpr_first_aid_bbp")
  );
}
