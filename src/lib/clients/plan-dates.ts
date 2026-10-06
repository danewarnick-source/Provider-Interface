// Plan-year dates: the plan years list (current / upcoming / ended and
// waiting / past), reminders before a plan year ends, the office follow-up
// once the client has waited 10 days for a new PCSP, and the support
// strategies due date. Pure (no Supabase), importable by node --test.
//
// There is no task or reminder table these fit, so readiness.ts turns them
// into needs-attention items (Overview, list flag, section badges).

import { daysUntil, parseLocalDate, todayYmd } from "./dates.ts";
import { planInEffectOn, planStatusOn, waitingDays, type ClientPlan, type PlanStatus } from "./plans.ts";

/** Days before a plan year ends that a reminder shows. */
export const PLAN_REMINDER_DAYS = [60, 30] as const;
/** Day of waiting for a new PCSP on which the office gets a follow-up task. */
export const WAITING_TASK_DAY = 10;
/** Days after the current plan's activation date that support strategies are due. */
export const STRATEGIES_DUE_DAYS = 30;

/** YYYY-MM-DD plus `days` (local calendar), or null for a bad date. */
export function addDaysYmd(value: string | null | undefined, days: number): string | null {
  const d = parseLocalDate(value);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Support strategies are due 30 days after the plan's activation date. */
export function strategiesDueOn(plan: Pick<ClientPlan, "activated_on"> | null | undefined): string | null {
  return addDaysYmd(plan?.activated_on ?? null, STRATEGIES_DUE_DAYS);
}

export type PlanYearKind = "current" | "upcoming" | "waiting" | "past";

export interface PlanYearRow {
  plan: ClientPlan;
  kind: PlanYearKind;
  /** Days the client has waited for a new plan (kind 'waiting' only). */
  waitingDays: number | null;
  /** Days until the plan ends (current plans with an end date). */
  daysLeft: number | null;
}

/**
 * Every plan year, newest first, labelled for the Plans section. The plan in
 * effect today that has passed its end date (and no newer plan) is
 * 'waiting'; other ended or replaced plans are 'past'.
 */
export function planYearRows(plans: readonly ClientPlan[], now: Date = new Date()): PlanYearRow[] {
  const today = todayYmd(now);
  const effect = planInEffectOn(plans, today);
  const waited = waitingDays(plans, now);
  return [...plans]
    .sort(
      (a, b) =>
        (b.start_date ?? "").localeCompare(a.start_date ?? "") ||
        (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    )
    .map((plan) => {
      const status: PlanStatus = planStatusOn(plan, today);
      let kind: PlanYearKind = status === "current" || status === "upcoming" ? status : "past";
      if (effect?.plan.id === plan.id && effect.status === "ended") kind = "waiting";
      return {
        plan,
        kind,
        waitingDays: kind === "waiting" ? waited : null,
        daysLeft: kind === "current" ? daysUntil(plan.end_date, now) : null,
      };
    });
}

export type PlanReminder =
  | { kind: "ending"; days: number; threshold: (typeof PLAN_REMINDER_DAYS)[number]; endDate: string }
  | { kind: "waiting"; days: number; officeTask: boolean };

/**
 * The plan-date reminder for today, if any: the plan in effect ends within
 * 60 (then 30) days, or it has ended and the client is waiting — with the
 * office follow-up from day 10 of waiting.
 */
export function planReminder(plans: readonly ClientPlan[], now: Date = new Date()): PlanReminder | null {
  const effect = planInEffectOn(plans, todayYmd(now));
  if (!effect) return null;
  if (effect.status === "ended") {
    const days = waitingDays(plans, now);
    if (days == null || days <= 0) return null;
    return { kind: "waiting", days, officeTask: days >= WAITING_TASK_DAY };
  }
  if (effect.status !== "current" || !effect.plan.end_date) return null;
  const days = daysUntil(effect.plan.end_date, now);
  if (days == null || days < 0) return null;
  const threshold = [...PLAN_REMINDER_DAYS].reverse().find((t) => days <= t);
  return threshold ? { kind: "ending", days, threshold, endDate: effect.plan.end_date.slice(0, 10) } : null;
}
