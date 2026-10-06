/**
 * Shared Evidence due-date calculator.
 * Packs supply defaults. Admin can always Set a date. No per-SOW engines.
 */

import type {
  EvidenceItemRow,
  EvidenceSubject,
  FirstDueRule,
  RenewYears,
} from "./types.ts";

export type EvidenceDueDefault = {
  firstDueRule: FirstDueRule;
  renewYears: RenewYears;
};

export type EvidenceDueDraft = {
  firstDueRule: FirstDueRule;
  firstDueOn: string | null;
  renewYears: RenewYears;
  nextDueMode: "years" | "set_date" | "none";
  nextDueOn: string | null;
};

export const LOCKED_DUE_DEFAULTS: Record<string, EvidenceDueDefault> = {
  thirty_day_orientation: { firstDueRule: "hire_30", renewYears: null },
  cpr_first_aid: { firstDueRule: "hire_90", renewYears: 2 },
  person_centered_thinking: { firstDueRule: "hire_90", renewYears: null },
  mandt_behavior: { firstDueRule: "hire_180", renewYears: 2 },
};

export const FIRST_DUE_OPTIONS_STAFF: { value: FirstDueRule; label: string }[] = [
  { value: "before_first_shift", label: "Before first shift" },
  { value: "hire_30", label: "Within 30 days of hire" },
  { value: "hire_90", label: "Within 90 days of hire" },
  { value: "hire_180", label: "Within 180 days of hire" },
  { value: "set_date", label: "Set a date" },
];

export const FIRST_DUE_OPTIONS_NON_HIRE: { value: FirstDueRule; label: string }[] = [
  { value: "set_date", label: "Set a date" },
];

export const NEXT_DUE_OPTIONS: { value: "1" | "2" | "set_date" | "none"; label: string }[] = [
  { value: "1", label: "Document date + 1 year" },
  { value: "2", label: "Document date + 2 years" },
  { value: "set_date", label: "Set a date" },
  { value: "none", label: "No renewal reminder" },
];

const HIRE_FIRST_DUE = new Set<FirstDueRule>([
  "before_first_shift",
  "hire_30",
  "hire_90",
  "hire_180",
]);

export function firstDueOptionsForSubject(
  subject: EvidenceSubject,
): { value: FirstDueRule; label: string }[] {
  return subject === "staff" ? FIRST_DUE_OPTIONS_STAFF : FIRST_DUE_OPTIONS_NON_HIRE;
}

export function parseIsoDate(value: string | null | undefined): string | null {
  const iso = (value ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : iso;
}

export function addDays(fromIso: string, days: number): string | null {
  const start = parseIsoDate(fromIso);
  if (!start) return null;
  const d = new Date(`${start}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addYears(fromIso: string, years: number): string | null {
  const start = parseIsoDate(fromIso);
  if (!start) return null;
  const d = new Date(`${start}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function resolveHireDate(
  hireDate: string | null | undefined,
  startDate?: string | null,
): string | null {
  return parseIsoDate(hireDate) ?? parseIsoDate(startDate);
}

export function isHireBasedFirstDue(rule: FirstDueRule | null | undefined): boolean {
  return !!rule && HIRE_FIRST_DUE.has(rule);
}

export function computeFirstDueOn(args: {
  rule: FirstDueRule | null | undefined;
  hireDate: string | null | undefined;
  setDate?: string | null;
}): string | null {
  const setDate = parseIsoDate(args.setDate);
  if (args.rule === "set_date") return setDate;
  const hire = resolveHireDate(args.hireDate);
  if (!hire) return setDate;
  if (args.rule === "before_first_shift") return hire;
  if (args.rule === "hire_30") return addDays(hire, 30);
  if (args.rule === "hire_90") return addDays(hire, 90);
  if (args.rule === "hire_180") return addDays(hire, 180);
  return setDate;
}

export function computeNextDueOn(args: {
  documentDate?: string | null;
  renewYears?: RenewYears;
  setDate?: string | null;
}): string | null {
  const setDate = parseIsoDate(args.setDate);
  if (setDate) return setDate;
  const years = args.renewYears;
  if (years !== 1 && years !== 2) return null;
  return addYears(args.documentDate ?? "", years);
}

export function needsHireDate(args: {
  subject: EvidenceSubject;
  rule: FirstDueRule | null | undefined;
  hireDate: string | null | undefined;
  firstDueOn?: string | null;
}): boolean {
  if (args.subject !== "staff") return false;
  if (!isHireBasedFirstDue(args.rule)) return false;
  if (parseIsoDate(args.firstDueOn)) return false;
  return !resolveHireDate(args.hireDate);
}

export function inferRenewYearsFromCadence(cadence: string | null | undefined): RenewYears {
  if (cadence === "annual") return 1;
  if (cadence === "every_2_years") return 2;
  return null;
}

export function cadenceFromDue(renewYears: RenewYears): "annual" | "every_2_years" | "once" {
  if (renewYears === 1) return "annual";
  if (renewYears === 2) return "every_2_years";
  return "once";
}

export function dueDefaultForRequirement(args: {
  key: string;
  subject: EvidenceSubject;
  cadence?: string | null;
  override?: EvidenceDueDefault;
}): EvidenceDueDefault {
  if (args.override) return args.override;
  const locked = LOCKED_DUE_DEFAULTS[args.key];
  if (locked) return locked;
  return {
    firstDueRule: args.subject === "staff" ? "before_first_shift" : "set_date",
    renewYears: inferRenewYearsFromCadence(args.cadence),
  };
}

export function firstDueLabel(rule: FirstDueRule | null | undefined): string {
  if (rule === "before_first_shift") return "Before first shift";
  if (rule === "hire_30") return "Within 30 days of hire";
  if (rule === "hire_90") return "Within 90 days of hire";
  if (rule === "hire_180") return "Within 180 days of hire";
  return "Set a date";
}

export function dueSubtitle(
  due: EvidenceDueDefault,
  subject: EvidenceSubject = "staff",
): string {
  const first =
    subject === "staff" && isHireBasedFirstDue(due.firstDueRule)
      ? due.firstDueRule === "before_first_shift"
        ? "First due before first shift"
        : `First due ${firstDueLabel(due.firstDueRule).toLowerCase()}`
      : "First due: set a date";
  if (due.renewYears === 1) return `${first} · then every 1 year from the document date`;
  if (due.renewYears === 2) return `${first} · then every 2 years from the certificate date`;
  return `${first} · no renewal reminder`;
}

export function dueSubtitleFromItem(
  item: Pick<
    EvidenceItemRow,
    "first_due_rule" | "renew_years" | "subject_type" | "next_due_on" | "first_due_on"
  >,
): string {
  const due: EvidenceDueDefault = {
    firstDueRule: item.first_due_rule ?? (item.subject_type === "staff" ? "before_first_shift" : "set_date"),
    renewYears: item.renew_years === 1 || item.renew_years === 2 ? item.renew_years : null,
  };
  return dueSubtitle(due, item.subject_type);
}

export function defaultDueDraft(
  subject: EvidenceSubject,
  due?: EvidenceDueDefault | null,
): EvidenceDueDraft {
  const firstDueRule =
    due?.firstDueRule ?? (subject === "staff" ? "before_first_shift" : "set_date");
  const renewYears = due?.renewYears ?? null;
  return {
    firstDueRule: subject === "staff" ? firstDueRule : "set_date",
    firstDueOn: null,
    renewYears,
    nextDueMode: renewYears === 1 || renewYears === 2 ? "years" : "none",
    nextDueOn: null,
  };
}

export function draftFromItem(
  item: Pick<
    EvidenceItemRow,
    "first_due_rule" | "first_due_on" | "renew_years" | "next_due_on" | "subject_type"
  >,
): EvidenceDueDraft {
  const renewYears = item.renew_years === 1 || item.renew_years === 2 ? item.renew_years : null;
  const nextDueMode = parseIsoDate(item.next_due_on)
    ? renewYears
      ? "years"
      : "set_date"
    : renewYears
      ? "years"
      : "none";
  return {
    firstDueRule:
      item.first_due_rule ?? (item.subject_type === "staff" ? "before_first_shift" : "set_date"),
    firstDueOn: parseIsoDate(item.first_due_on),
    renewYears,
    nextDueMode: item.next_due_on && !renewYears ? "set_date" : nextDueMode,
    nextDueOn: renewYears ? null : parseIsoDate(item.next_due_on),
  };
}

export function applyDueDraft(args: {
  draft: EvidenceDueDraft;
  hireDate: string | null | undefined;
  documentDate?: string | null;
  hasFile?: boolean;
}): {
  first_due_rule: FirstDueRule;
  first_due_on: string | null;
  renew_years: RenewYears;
  next_due_on: string | null;
  document_date: string | null;
  expires_on: string | null;
} {
  const first_due_on = computeFirstDueOn({
    rule: args.draft.firstDueRule,
    hireDate: args.hireDate,
    setDate: args.draft.firstDueOn,
  });
  const renew_years =
    args.draft.nextDueMode === "years" && (args.draft.renewYears === 1 || args.draft.renewYears === 2)
      ? args.draft.renewYears
      : null;
  const document_date = parseIsoDate(args.documentDate);
  const next_due_on =
    args.draft.nextDueMode === "set_date"
      ? parseIsoDate(args.draft.nextDueOn)
      : args.draft.nextDueMode === "none"
        ? null
        : args.hasFile || document_date
          ? computeNextDueOn({
              documentDate: document_date,
              renewYears: renew_years,
            })
          : null;
  const expires_on = args.hasFile || document_date ? next_due_on : first_due_on;
  return {
    first_due_rule: args.draft.firstDueRule,
    first_due_on,
    renew_years,
    next_due_on,
    document_date,
    expires_on,
  };
}

export function effectiveAttentionDate(args: {
  hasFile: boolean;
  firstDueOn?: string | null;
  nextDueOn?: string | null;
  expiresOn?: string | null;
}): string | null {
  if (args.hasFile) {
    return parseIsoDate(args.nextDueOn) ?? parseIsoDate(args.expiresOn);
  }
  return parseIsoDate(args.firstDueOn) ?? parseIsoDate(args.expiresOn);
}
