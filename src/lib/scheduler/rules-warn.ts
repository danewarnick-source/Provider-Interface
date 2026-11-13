// Warn rules that are not Evidence-based: rest, fatigue, travel gaps, staffing
// preferences, worksheet hours, and the assumed ratio (Decision 13). Each rule
// returns its default level; the agency's strength is applied in rules.ts.
import { denverWallToIso } from "../denver-date.ts";
import { RATIO_CODES } from "./ratios.ts";
import { evidenceStateOn } from "./rules-qualifications.ts";
import type { Finding, RuleContext, RuleShift } from "./rules-types.ts";
import {
  clientOf, dayOf, find, firstName, ms, othersOf, staffOf, sumHours, up, weekOf,
} from "./rules-util.ts";
import { addDaysKey, daysBetween, weekdayOf } from "./time.ts";

const HOUR = 3_600_000;

function staffShifts(s: RuleShift, ctx: RuleContext, batch: readonly RuleShift[]): RuleShift[] {
  const mine = othersOf(s, ctx, batch).filter((o) => o.staffId === s.staffId && !o.parentShiftId);
  return [s, ...mine].filter((o) => !o.parentShiftId).sort((a, b) => ms(a.startsAt) - ms(b.startsAt));
}

export function worksheetHoursRule(s: RuleShift, ctx: RuleContext, batch: readonly RuleShift[]): Finding[] {
  const client = clientOf(ctx, s);
  const auth = client?.authorizations.find((a) => up(a.code) === up(s.code));
  const target = auth?.weeklyHoursTarget;
  if (!client || !target) return [];
  const week = sumHours([s, ...othersOf(s, ctx, batch).filter((o) =>
    o.clientId === s.clientId && up(o.code) === up(s.code) && weekOf(o) === weekOf(s) && !o.parentShiftId)]);
  return week < target
    ? [find("below_worksheet_hours", "warn",
        `${firstName(client.name)} has ${week.toFixed(1)} of ${target} ${up(s.code)} hours on the Worksheet this week`)]
    : [];
}

export function restAndStraightRules(s: RuleShift, ctx: RuleContext, batch: readonly RuleShift[]): Finding[] {
  const staff = staffOf(ctx, s);
  if (!staff || s.parentShiftId) return [];
  const out: Finding[] = [];
  const list = staffShifts(s, ctx, batch);
  const i = list.findIndex((x) => x.id === s.id);
  const restMin = (ctx.settings.minRestHours ?? 8) * HOUR;
  const prev = list[i - 1];
  const next = list[i + 1];
  const gapPrev = prev ? ms(s.startsAt) - ms(prev.endsAt) : null;
  const gapNext = next ? ms(next.startsAt) - ms(s.endsAt) : null;
  const short = [gapPrev, gapNext].find((g) => g !== null && g > 0 && g < restMin);
  if (short != null) {
    out.push(find("under_rest", "warn",
      `${firstName(staff.name)} would get only ${(short / HOUR).toFixed(1)} hours of rest between shifts`));
  }
  // chain back-to-back shifts (gap 0) around s
  let lo = i, hi = i;
  while (lo > 0 && ms(list[lo - 1]!.endsAt) === ms(list[lo]!.startsAt)) lo--;
  while (hi < list.length - 1 && ms(list[hi + 1]!.startsAt) === ms(list[hi]!.endsAt)) hi++;
  const hours = (ms(list[hi]!.endsAt) - ms(list[lo]!.startsAt)) / HOUR;
  if (hours > 16) {
    out.push(find("over_16h_straight", "warn", `${firstName(staff.name)} would work ${hours.toFixed(1)} hours straight (over 16)`));
  }
  return out;
}

export function overtimeRule(s: RuleShift, ctx: RuleContext, batch: readonly RuleShift[]): Finding[] {
  const staff = staffOf(ctx, s);
  if (!staff || s.parentShiftId) return [];
  const limit = ctx.settings.overtimeThresholdHours ?? 40;
  const week = sumHours(staffShifts(s, ctx, batch).filter((o) => weekOf(o) === weekOf(s)));
  return week > limit
    ? [find("overtime", "warn", `${firstName(staff.name)} would have ${week.toFixed(1)} hours this week (overtime starts at ${limit})`)]
    : [];
}

/** Rolling 16 hours worked in any 24 hours, counting holdovers and declared outside hours. */
export function fatigueRule(s: RuleShift, ctx: RuleContext, batch: readonly RuleShift[]): Finding[] {
  const staff = staffOf(ctx, s);
  if (!staff || s.parentShiftId) return [];
  const list = staffShifts(s, ctx, batch);
  const day24 = 24 * HOUR;
  for (const anchor of list) {
    const from = ms(anchor.startsAt), to = from + day24;
    let worked = 0;
    for (const o of list) {
      worked += Math.max(0, Math.min(ms(o.endsAt), to) - Math.max(ms(o.startsAt), from)) / HOUR;
    }
    worked += staff.outsideHours?.[dayOf(anchor)] ?? 0;
    const touches = ms(s.startsAt) < to && ms(s.endsAt) > from;
    if (touches && worked > 16) {
      const hold = list.some((o) => o.holdover && ms(o.startsAt) < to && ms(o.endsAt) > from);
      return [find("fatigue_16_in_24", "warn",
        `${firstName(staff.name)} would work ${worked.toFixed(1)} of 24 hours${hold ? " (with a holdover)" : ""}`)];
    }
  }
  return [];
}

export function travelGapRule(s: RuleShift, ctx: RuleContext, batch: readonly RuleShift[]): Finding[] {
  const staff = staffOf(ctx, s);
  if (!staff || !s.address || s.parentShiftId) return [];
  const minutes = ctx.settings.travelGapMinutes ?? 20;
  const hit = othersOf(s, ctx, batch).find((o) => {
    if (o.staffId !== s.staffId || o.parentShiftId || !o.address || o.address === s.address) return false;
    const gap = ms(o.startsAt) >= ms(s.endsAt) ? ms(o.startsAt) - ms(s.endsAt) : ms(s.startsAt) - ms(o.endsAt);
    return gap >= 0 && gap < minutes * 60_000;
  });
  return hit
    ? [find("travel_gap", "warn", `${firstName(staff.name)} has under ${minutes} minutes to get between two addresses`)]
    : [];
}

export function preferenceRule(s: RuleShift, ctx: RuleContext): Finding[] {
  const client = clientOf(ctx, s);
  const staff = staffOf(ctx, s);
  if (!client || !staff) return [];
  const out: Finding[] = [];
  for (const p of client.preferences ?? []) {
    if (p.codes?.length && !p.codes.map(up).includes(up(s.code))) continue;
    if (p.requiresStaffGender && staff.gender && staff.gender !== p.requiresStaffGender) {
      out.push(find("client_preference", p.block ? "block" : "warn", `${firstName(client.name)} prefers ${p.label}`));
    }
  }
  return out;
}

/** Decision 13: an assumed ratio warns, and blocks once 15 days pass since approval. */
export function assumedRatioRule(s: RuleShift, ctx: RuleContext): Finding[] {
  if (!RATIO_CODES.has(up(s.code)) || !s.groupClientIds?.length) return [];
  const out: Finding[] = [];
  for (const id of s.groupClientIds) {
    const client = ctx.clients[id];
    if (!client || client.ratios?.some((r) => up(r.code) === up(s.code) && r.confirmed)) continue;
    const approved = client.authorizations.find((a) => up(a.code) === up(s.code))?.approvedOn;
    const late = !!approved && daysBetween(approved, ctx.today) >= 15;
    out.push(find("assumed_ratio", late ? "block" : "warn",
      late
        ? `${firstName(client.name)}'s ${up(s.code)} ratio is still assumed, 15 days after approval; confirm it to publish`
        : `${firstName(client.name)}'s ${up(s.code)} ratio is assumed; confirm it before ${approved ? addDaysKey(approved, 15) : "publishing"}`));
  }
  return out;
}

/** Time-window needs on a home slot or session ("7-9 a.m.: 1 med-trained"), via Evidence. */
export function windowRequirementRules(s: RuleShift, ctx: RuleContext, batch: readonly RuleShift[]): Finding[] {
  const out: Finding[] = [];
  const day = dayOf(s);
  for (const req of s.windowRequirements ?? []) {
    const [fh, fm] = req.from.split(":").map(Number);
    const [th, tm] = req.to.split(":").map(Number);
    const from = new Date(denverWallToIso(day, fh!, fm!)).getTime();
    const to = new Date(denverWallToIso(day, th!, tm!)).getTime();
    const crew = [s, ...othersOf(s, ctx, batch).filter((o) => o.teamId === s.teamId && up(o.code) === up(s.code))]
      .filter((o) => !!o.staffId && !o.parentShiftId && ms(o.startsAt) < to && ms(o.endsAt) > from);
    const held = new Set(crew.filter((o) =>
      evidenceStateOn(ctx.evidence[o.staffId!], req.qualificationKey, day).state === "valid").map((o) => o.staffId));
    if (held.size < req.count) {
      out.push(find("window_qualification", "warn",
        `${req.from}-${req.to}: ${held.size} of ${req.count} ${req.label}`));
    }
  }
  return out;
}


/** Outside the weekly availability the person gave. Warn. */
export function availabilityRule(s: RuleShift, ctx: RuleContext): Finding[] {
  const staff = staffOf(ctx, s);
  const windows = staff?.availability?.[weekdayOf(dayOf(s))];
  if (!staff || !staff.availability || s.parentShiftId) return [];
  if (!windows || windows.length === 0) return [];
  const day = dayOf(s);
  const inside = windows.some(([from, to]) => {
    const [fh, fm] = from.split(":").map(Number);
    const [th, tm] = to.split(":").map(Number);
    return ms(s.startsAt) >= ms(denverWallToIso(day, fh!, fm!)) && ms(s.endsAt) <= ms(denverWallToIso(day, th!, tm!));
  });
  return inside ? [] : [find("outside_availability", "warn", `${firstName(staff.name)} said they aren't available then`)];
}
