// Small shared helpers for the rule files. Pure; all day math is Denver.
import { addDaysKey, dayKey, weekStartKey } from "./time.ts";
import type {
  AgencyRuleKey, ClientFacts, Finding, Level, RuleContext, RuleShift, StaffFacts,
} from "./rules-types.ts";

export const MS_HOUR = 3_600_000;

export function ms(iso: string): number {
  return new Date(iso).getTime();
}
export function minutesOf(s: RuleShift): number {
  return Math.max(0, (ms(s.endsAt) - ms(s.startsAt)) / 60_000);
}
export function hoursOf(s: RuleShift): number {
  return minutesOf(s) / 60;
}
export function overlaps(a: RuleShift, b: RuleShift): boolean {
  return ms(a.startsAt) < ms(b.endsAt) && ms(b.startsAt) < ms(a.endsAt);
}
export function dayOf(s: RuleShift): string {
  return dayKey(s.startsAt);
}
export function weekOf(s: RuleShift): string {
  return weekStartKey(dayOf(s));
}
export function isLive(s: RuleShift): boolean {
  return s.status !== "cancelled" && s.status !== "declined";
}
export function up(code: string | null | undefined): string {
  return (code ?? "").toUpperCase();
}
/** Segment pair: one is the other's parent. Never a conflict. */
export function isSegmentPair(a: RuleShift, b: RuleShift): boolean {
  return a.parentShiftId === b.id || b.parentShiftId === a.id;
}

export function firstName(name: string | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first || "This team member";
}
export function staffOf(ctx: RuleContext, s: RuleShift): StaffFacts | null {
  return s.staffId ? ctx.staff[s.staffId] ?? null : null;
}
export function clientOf(ctx: RuleContext, s: RuleShift): ClientFacts | null {
  return s.clientId ? ctx.clients[s.clientId] ?? null : null;
}

/** Other live shifts (never the shift itself) from the context plus the batch. */
export function othersOf(s: RuleShift, ctx: RuleContext, batch: readonly RuleShift[] = []): RuleShift[] {
  const seen = new Set<string>([s.id]);
  const out: RuleShift[] = [];
  for (const o of [...ctx.shifts, ...batch]) {
    if (seen.has(o.id) || !isLive(o)) continue;
    seen.add(o.id);
    out.push(o);
  }
  return out;
}

/** Level for an Agency rule: null when the agency turned it off. */
export function agencyLevel(ctx: RuleContext, key: AgencyRuleKey, dflt: Level): Level | null {
  const r = ctx.settings.rules?.[key];
  if (!r) return dflt;
  return r.enabled ? r.level : null;
}

export function find(rule: string, level: Level, message: string, fix?: Finding["fix"]): Finding {
  return fix ? { rule, level, message, fix } : { rule, level, message };
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i));
}

/** Hours of the live same-staff, same-code shifts on a day (top-level only). */
export function sumHours(list: readonly RuleShift[]): number {
  return list.reduce((a, s) => a + hoursOf(s), 0);
}
