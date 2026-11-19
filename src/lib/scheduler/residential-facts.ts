// Facts about a group home resident that the home page and the rule engine
// both read (B7), so they never disagree: the Form 930 covering a day
// (client_documents of type form_930, dated effective_from–effective_to,
// §21.3(4)), absence days used this plan year against the Worksheet number
// (client_absences vs client_billing_codes.worksheet_absence_days, §21.3(3)),
// and whether a shift is an RHS 1:1 (an RHS shift at a home that names one
// of its residents, Decision 16). Pure.
import { absenceDays } from "../clients/health/health.ts";
import { planYearOf } from "./auth-outlook.ts";
import { codeActiveOn } from "./board-model.ts";

export const FORM_930 = "form_930";

export type Form930Doc = {
  client_id: string;
  effective_from: string | null;
  effective_to: string | null;
};
export type AbsenceRow = { client_id: string; from_date: string; to_date: string | null };
export type RhsCodeRow = {
  client_id: string;
  service_code: string;
  service_start_date: string | null;
  service_end_date: string | null;
  worksheet_weekly_hours: number | null;
  worksheet_absence_days: number | null;
};

/** The Form 930 in effect for a client on a day; the one that runs longest wins. */
export function form930On(
  docs: readonly Form930Doc[],
  clientId: string,
  day: string,
): Form930Doc | null {
  const live = docs.filter(
    (d) =>
      d.client_id === clientId &&
      (!d.effective_from || d.effective_from <= day) &&
      (!d.effective_to || day <= d.effective_to),
  );
  return (
    live.sort((a, b) =>
      !a.effective_to ? -1 : !b.effective_to ? 1 : b.effective_to.localeCompare(a.effective_to),
    )[0] ?? null
  );
}

/** The client's RHS authorization in effect on a day, else the latest one. */
export function rhsCodeOf(
  codes: readonly RhsCodeRow[],
  clientId: string,
  day: string,
): RhsCodeRow | null {
  const mine = codes.filter(
    (c) => c.client_id === clientId && c.service_code.trim().toUpperCase() === "RHS",
  );
  return (
    mine.find((c) => codeActiveOn(c, day)) ??
    [...mine].sort((a, b) =>
      (b.service_start_date ?? "").localeCompare(a.service_start_date ?? ""),
    )[0] ??
    null
  );
}

/** Days away within the plan year of the RHS code (an open absence counts through today). */
export function absenceDaysUsed(
  absences: readonly AbsenceRow[],
  clientId: string,
  code: Pick<RhsCodeRow, "service_start_date" | "service_end_date"> | null,
  today: string,
): number {
  const plan = code ? planYearOf(code.service_start_date, code.service_end_date) : null;
  if (!plan) return 0;
  return absences
    .filter((a) => a.client_id === clientId)
    .reduce((n, a) => {
      const from = a.from_date > plan.start ? a.from_date : plan.start;
      const end = a.to_date ?? today;
      const to = end < plan.end ? end : plan.end;
      return n + (absenceDays(from, to) ?? 0);
    }, 0);
}

/** "x of y" absence days for the home page; y is null with no Worksheet number. */
export function absenceUse(
  absences: readonly AbsenceRow[],
  codes: readonly RhsCodeRow[],
  clientId: string,
  today: string,
): { used: number; allowed: number | null } {
  const code = rhsCodeOf(codes, clientId, today);
  return {
    used: absenceDaysUsed(absences, clientId, code, today),
    allowed: code?.worksheet_absence_days ?? null,
  };
}

/** Worksheet absence days not yet used, for the ELS rule; undefined without a Worksheet number. */
export function absenceDaysLeft(
  absences: readonly AbsenceRow[],
  codes: readonly RhsCodeRow[],
  clientId: string,
  today: string,
): number | undefined {
  const u = absenceUse(absences, codes, clientId, today);
  return u.allowed == null ? undefined : Math.max(0, u.allowed - u.used);
}

/** An RHS shift at a home that names one of that home's residents is a 1:1. */
export function isResidentOneToOne(
  s: { code: string; teamId: string | null; clientId: string | null },
  clientHome: string | null | undefined,
): boolean {
  return (
    s.code.trim().toUpperCase() === "RHS" && !!s.teamId && !!s.clientId && clientHome === s.teamId
  );
}
