// The PCSP's state for one client today and the one wording for it. Every
// place that talks about the plan year uses these words: the Plans card, the
// Overview's Needs attention, the profile header's Plan year tile and the
// Clients list's Next due cell. Pure (no Supabase), importable by node --test.

import { daysUntil, formatDate, todayYmd } from "./dates.ts";
import { planInEffectOn, waitingDays, type ClientPlan } from "./plans.ts";

/** Days before a plan year ends that a reminder shows. */
export const PLAN_REMINDER_DAYS = [60, 30] as const;
/** Days overdue from which the message adds "contact the support coordinator". */
export const WAITING_TASK_DAY = 10;

export type PcspState =
  | { kind: "none" }
  /** In effect and more than 60 days from its end (or no end date). */
  | { kind: "ok"; endDate: string | null; days: number | null }
  | { kind: "expiring"; endDate: string; days: number; threshold: (typeof PLAN_REMINDER_DAYS)[number] }
  | { kind: "overdue"; endDate: string | null; days: number; followUp: boolean };

/** What the client's plan years say today. */
export function pcspState(plans: readonly ClientPlan[], now: Date = new Date()): PcspState {
  const today = todayYmd(now);
  const effect = planInEffectOn(plans, today);
  if (!effect) {
    // Only a plan year that hasn't started yet: nothing is due.
    const next = plans.find((p) => p.start_date && p.start_date.slice(0, 10) > today);
    return next ? { kind: "ok", endDate: next.end_date?.slice(0, 10) ?? null, days: daysUntil(next.end_date, now) } : { kind: "none" };
  }
  const endDate = effect.plan.end_date ? effect.plan.end_date.slice(0, 10) : null;
  if (effect.status === "ended") {
    const days = waitingDays(plans, now) ?? 0;
    if (days > 0) return { kind: "overdue", endDate, days, followUp: days >= WAITING_TASK_DAY };
  }
  const days = daysUntil(endDate, now);
  if (endDate && days != null && days >= 0) {
    const threshold = [...PLAN_REMINDER_DAYS].reverse().find((t) => days <= t);
    if (threshold) return { kind: "expiring", endDate, days, threshold };
  }
  return { kind: "ok", endDate, days };
}

const dayCount = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
const shortDate = (ymd: string) => formatDate(ymd, { month: "short", day: "numeric" });

/**
 * "PCSP is 12 days overdue" / "PCSP expires in 30 days (Nov 5)" for a plan
 * year ending `endDate`, `days` from today (negative once it has ended).
 */
export function pcspDueHeadline(days: number, endDate: string): string {
  if (days < 0) return `PCSP is ${dayCount(-days)} overdue`;
  if (days === 0) return `PCSP expires today (${shortDate(endDate)})`;
  return `PCSP expires in ${dayCount(days)} (${shortDate(endDate)})`;
}

export type PcspWords = {
  headline: string;
  /** The next step, as a sentence; null when nothing is due. */
  action: string | null;
  /** The button that fixes it. */
  fix: "upload" | "schedule" | null;
};

/** The message for a PCSP state; null when there is nothing to say. */
export function pcspWords(s: PcspState): PcspWords | null {
  if (s.kind === "none") return { headline: "No PCSP on file", action: "Upload the PCSP.", fix: "upload" };
  if (s.kind === "expiring") {
    return {
      headline: pcspDueHeadline(s.days, s.endDate),
      action: "Schedule the PCSP meeting with the support coordinator.",
      fix: "schedule",
    };
  }
  if (s.kind === "overdue") {
    return {
      headline: `PCSP is ${dayCount(s.days)} overdue`,
      action: s.followUp
        ? "Upload it, or contact the support coordinator if you don't have it yet."
        : "Upload the new PCSP.",
      fix: "upload",
    };
  }
  return null;
}

/** "PCSP is 12 days overdue. Upload the new PCSP." */
export function pcspSentence(w: PcspWords): string {
  return w.action ? `${w.headline}. ${w.action}` : `${w.headline}.`;
}

/** Badge on an ended plan year still waiting for the new PCSP. */
export function expiredBadge(days: number): string {
  return days === 0 ? "Expired today" : `Expired ${dayCount(days)} ago`;
}

/**
 * Codes the current plan pays the agency for that have no authorization
 * covering today: after a new PCSP these need the new 1056 entered.
 */
export function codesNeeding1056(
  planCodes: readonly string[],
  auths: readonly { service_code: string; service_start_date: string | null; service_end_date: string | null }[],
  today: string,
): string[] {
  const covered = new Set(
    auths
      .filter(
        (a) =>
          (!a.service_start_date || a.service_start_date.slice(0, 10) <= today) &&
          (!a.service_end_date || a.service_end_date.slice(0, 10) >= today),
      )
      .map((a) => a.service_code.trim().toUpperCase()),
  );
  const want = [...new Set(planCodes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  return want.filter((c) => !covered.has(c)).sort();
}
