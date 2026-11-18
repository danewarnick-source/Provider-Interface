// The Publish / Send changes checklist for one week (B4), from the week's
// shifts, its unsent changes (collapsed per shift, shift-change.ts) and the
// rule engine's findings for the drafts and changed shifts. Pure; the server
// (publish.functions.ts) loads the facts and runs the engine; the dialog
// (components/scheduler/board/publish-dialog.tsx) shows the result.
// Order: blocks (Send stays disabled), shifts needing a reason (a reason saved
// on the shift or typed now satisfies it), reminders, over the overtime
// threshold, who gets a notice, open shifts offered at Send.
import type { Finding } from "./rules-types.ts";
import type { NetChange } from "./shift-change.ts";
import { dayKey } from "./time.ts";

export type PlanShift = {
  id: string;
  staff_id: string | null;
  status: string;
  published: boolean;
  override_reason: string | null;
  starts_at: string;
  ends_at: string;
};

export type PlanLine = { shiftId: string; rule: string; message: string };

export type PublishPlan = {
  /** Staffed, live, unpublished shifts in the week: published at Send. */
  drafts: string[];
  /** Live open shifts nobody has been offered yet: offered at Send. */
  openToOffer: string[];
  /** Net changes that tell someone something. */
  changes: NetChange[];
  /** Every unsent change id in the week, marked sent at Send (including ones that cancel out). */
  changeIds: string[];
  /** Shifts the engine checked (drafts and changed, staffed, live). */
  checked: string[];
  blocks: PlanLine[];
  needReason: PlanLine[];
  reminders: PlanLine[];
  overtime: { staffId: string; hours: number }[];
  /** Everyone who gets one notice: the new and old person of each change, and each draft's person. */
  notify: string[];
  /** The header's N: changes plus drafts (staffed and open). */
  count: number;
};

const live = (s: { status: string }) => s.status !== "cancelled" && s.status !== "declined";
const hours = (s: PlanShift) =>
  Math.max(0, (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 3_600_000);

export function publishPlan(input: {
  shifts: readonly PlanShift[];
  changes: readonly NetChange[];
  findings: readonly Finding[];
  otHours: number;
  weekDays: readonly string[];
}): PublishPlan {
  const inWeek = input.shifts.filter((s) => input.weekDays.includes(dayKey(s.starts_at)));
  const byId = new Map(input.shifts.map((s) => [s.id, s]));
  const drafts = inWeek.filter((s) => live(s) && s.staff_id && !s.published);
  const openToOffer = inWeek.filter((s) => live(s) && !s.staff_id && !s.published).map((s) => s.id);
  const real = input.changes.filter((c) => c.real);
  const checked = new Set(drafts.map((s) => s.id));
  for (const c of real) {
    const s = byId.get(c.shiftId);
    if (s && live(s) && s.staff_id) checked.add(s.id);
  }
  const blocks: PlanLine[] = [];
  const needReason: PlanLine[] = [];
  const reminders: PlanLine[] = [];
  const seen = new Set<string>();
  for (const f of input.findings) {
    if (!f.shiftId || !checked.has(f.shiftId)) continue;
    const key = `${f.shiftId}|${f.rule}|${f.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const line = { shiftId: f.shiftId, rule: f.rule, message: f.message };
    if (f.level === "block") blocks.push(line);
    else if (f.level === "reason" && !byId.get(f.shiftId)?.override_reason?.trim())
      needReason.push(line);
    else reminders.push(line);
  }
  const perStaff = new Map<string, number>();
  for (const s of inWeek)
    if (live(s) && s.staff_id) perStaff.set(s.staff_id, (perStaff.get(s.staff_id) ?? 0) + hours(s));
  const overtime = [...perStaff]
    .filter(([, h]) => h > input.otHours)
    .map(([staffId, h]) => ({ staffId, hours: Math.round(h * 100) / 100 }))
    .sort((a, b) => b.hours - a.hours);
  const notify = new Set<string>();
  for (const c of real) c.affected.forEach((id) => notify.add(id));
  for (const s of drafts) notify.add(s.staff_id!);
  return {
    drafts: drafts.map((s) => s.id),
    openToOffer,
    changes: real,
    changeIds: input.changes.flatMap((c) => c.changeIds),
    checked: [...checked],
    blocks,
    needReason,
    reminders,
    overtime,
    notify: [...notify],
    count: real.length + drafts.length + openToOffer.length,
  };
}

/** Why Send is disabled, or null when it may go. `reasons` = typed reasons by shift id. */
export function sendBlocker(
  plan: PublishPlan,
  reasons: Readonly<Record<string, string>>,
): string | null {
  if (plan.blocks.length)
    return `Fix ${plan.blocks.length === 1 ? "the block" : `the ${plan.blocks.length} blocks`} first.`;
  const missing = new Set(
    plan.needReason.filter((l) => !reasons[l.shiftId]?.trim()).map((l) => l.shiftId),
  );
  if (missing.size)
    return `Add a reason for ${missing.size === 1 ? "1 shift" : `${missing.size} shifts`} first.`;
  if (!plan.count) return "Nothing new to send.";
  return null;
}

/** "Use this reason for all N like it": the other shifts needing a reason for the same rule. */
export function sameRuleShifts(plan: PublishPlan, line: PlanLine): string[] {
  return [...new Set(plan.needReason.filter((l) => l.rule === line.rule).map((l) => l.shiftId))];
}
