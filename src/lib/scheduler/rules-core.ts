// Core block rules: authorization, team, do-not-schedule, staff status, double
// booking, age, segments, 1:1 and 2:1 staffing, group size, and the hour caps.
// Each rule is a small pure function returning findings (Decision 18: SOW rules
// are always on). Sections cite DHHS91172.
import { assignmentCoversCode } from "../assignment-codes.ts";
import { billingFor, DAILY_UNIT_CODES } from "./billing-mode.ts";
import { defaultRatio, staffNeeded, type Ratio } from "./ratios.ts";
import type { Finding, RuleContext, RuleShift } from "./rules-types.ts";
import {
  clientOf, dayOf, find, firstName, isSegmentPair, minutesOf, othersOf, overlaps,
  staffOf, sumHours, up, weekOf,
} from "./rules-util.ts";
import { dayKey } from "./time.ts";

/** Services that may overlap other services (§2.1(5)(G)). */
export const OVERLAP_OK_CODES: ReadonlySet<string> = new Set([
  "BC1", "BC2", "BC3", "HSQ", "PM1", "PM2", "PBA", "PN1", "PN2",
]);

const DAILY_RESIDENTIAL = new Set(["RHS", "HHS", "PPS"]);
const HOURLY_INSIDE_RESIDENTIAL = new Set(["DSI", "SEI"]);

export function authorizationFor(s: RuleShift, ctx: RuleContext) {
  const client = clientOf(ctx, s);
  const day = dayOf(s);
  return client?.authorizations.find(
    (a) => up(a.code) === up(s.code) && a.startDate <= day && (!a.endDate || day <= a.endDate),
  ) ?? null;
}

export function authorizationRule(s: RuleShift, ctx: RuleContext, batch: readonly RuleShift[]): Finding[] {
  const client = clientOf(ctx, s);
  if (!client) return [];
  const day = dayOf(s);
  const auth = authorizationFor(s, ctx);
  if (!auth) {
    return [find("no_authorization", "block",
      `${firstName(client.name)} has no ${up(s.code)} authorization on ${day} (§2.1(5)(J))`)];
  }
  if (auth.unitsLeft === null) return [];
  const same = [s, ...othersOf(s, ctx, batch).filter((o) =>
    o.clientId === s.clientId && up(o.code) === up(s.code) && dayOf(o) === day && !o.parentShiftId === !s.parentShiftId)];
  const total = billingFor(s.code, same.map(minutesOf), day).units;
  if (total > auth.unitsLeft) {
    return [find("over_authorized_units", "block",
      `${up(s.code)} for ${firstName(client.name)} would use ${total} units but only ${auth.unitsLeft} are left (§2.1(5)(J))`)];
  }
  return [];
}

export function teamRules(s: RuleShift, ctx: RuleContext): Finding[] {
  const client = clientOf(ctx, s);
  const staff = staffOf(ctx, s);
  if (!client || !staff) return [];
  const out: Finding[] = [];
  if (client.doNotScheduleStaffIds.includes(staff.id)) {
    const why = client.doNotScheduleReasons?.[staff.id]?.trim();
    out.push(find("do_not_schedule", "block",
      `${firstName(staff.name)} is on ${firstName(client.name)}'s do-not-schedule list${why ? `: ${why}` : ""}`));
  }
  if (!client.teamStaffIds.includes(staff.id)) {
    out.push(find("not_on_team", "block", `${firstName(staff.name)} isn't on ${firstName(client.name)}'s team`));
  } else if (client.teamCodes && !assignmentCoversCode(client.teamCodes[staff.id], s.code)) {
    out.push(find("code_not_assigned", "block",
      `${firstName(staff.name)} isn't assigned ${up(s.code)} for ${firstName(client.name)}`));
  }
  return out;
}

export function staffStatusRules(s: RuleShift, ctx: RuleContext): Finding[] {
  const staff = staffOf(ctx, s);
  if (!staff) return [];
  const out: Finding[] = [];
  if (!staff.active) out.push(find("staff_inactive", "block", `${firstName(staff.name)} is inactive`));
  const start = dayKey(s.startsAt);
  const end = dayKey(new Date(Math.max(new Date(s.startsAt).getTime(), new Date(s.endsAt).getTime() - 1)));
  if (staff.timeOff.some(([a, b]) => start <= b && end >= a)) {
    out.push(find("on_time_off", "block", `${firstName(staff.name)} has approved time off then`));
  }
  return out;
}

export function overlapRules(s: RuleShift, ctx: RuleContext, batch: readonly RuleShift[]): Finding[] {
  const out: Finding[] = [];
  const client = clientOf(ctx, s);
  for (const o of othersOf(s, ctx, batch)) {
    if (!overlaps(s, o) || isSegmentPair(s, o)) continue;
    if (s.staffId && o.staffId === s.staffId) {
      out.push(find("staff_double_booked", "block",
        `${firstName(staffOf(ctx, s)?.name)} is already in another place then`));
      continue;
    }
    if (!s.clientId || o.clientId !== s.clientId) continue;
    const a = up(s.code), b = up(o.code);
    if (OVERLAP_OK_CODES.has(a) || OVERLAP_OK_CODES.has(b)) continue;
    if (a === b && s.staffId && o.staffId && s.staffId !== o.staffId) continue; // 2:1, below
    const residentialPair = (DAILY_RESIDENTIAL.has(a) && HOURLY_INSIDE_RESIDENTIAL.has(b)) ||
      (DAILY_RESIDENTIAL.has(b) && HOURLY_INSIDE_RESIDENTIAL.has(a));
    if (residentialPair) continue; // Decision 5
    out.push(find("client_double_booked", "block",
      `${firstName(client?.name)} already has ${b} at the same time (§2.1(5)(G))`));
  }
  return out;
}

export function twoToOneRule(s: RuleShift, ctx: RuleContext, batch: readonly RuleShift[]): Finding[] {
  const client = clientOf(ctx, s);
  if (!client || client.hasRightsModification) return [];
  const pair = othersOf(s, ctx, batch).some((o) =>
    o.clientId === s.clientId && overlaps(s, o) && !isSegmentPair(s, o) &&
    up(o.code) === up(s.code) && !!o.staffId && !!s.staffId && o.staffId !== s.staffId &&
    !OVERLAP_OK_CODES.has(up(s.code)));
  const declared = s.staffingRatio && s.staffingRatio.staff >= 2 && s.staffingRatio.clients === 1;
  return pair || declared
    ? [find("two_to_one_no_rights_mod", "block",
        `Two staff with ${firstName(client.name)} at once needs a rights modification (§1.33(2))`)]
    : [];
}

export function enhancedStaffingRule(s: RuleShift, ctx: RuleContext, batch: readonly RuleShift[]): Finding[] {
  const client = clientOf(ctx, s);
  if (up(s.code) !== "RHS" || !client || client.hasForm930) return [];
  const oneToOne = (x: RuleShift) => !!x.staffingRatio && x.staffingRatio.staff === 1 && x.staffingRatio.clients === 1;
  if (!oneToOne(s)) return [];
  const mine = [s, ...othersOf(s, ctx, batch).filter((o) =>
    o.clientId === s.clientId && up(o.code) === "RHS" && oneToOne(o) && dayOf(o) === dayOf(s))];
  return sumHours(mine) >= 4
    ? [find("rhs_one_to_one_no_form_930", "block",
        `${firstName(client.name)} has 4+ hours of 1:1 a day and no Form 930 yet (§21.3(4))`)]
    : [];
}

export function segmentRules(s: RuleShift, ctx: RuleContext, batch: readonly RuleShift[]): Finding[] {
  if (!s.parentShiftId) return [];
  const out: Finding[] = [];
  if (DAILY_UNIT_CODES.includes(up(s.code))) {
    out.push(find("daily_on_segment", "block", `${up(s.code)} is a daily code and can't be a 1:1 segment`));
  }
  const parent = [...ctx.shifts, ...batch].find((p) => p.id === s.parentShiftId);
  if (parent && (new Date(s.startsAt) < new Date(parent.startsAt) || new Date(s.endsAt) > new Date(parent.endsAt))) {
    out.push(find("segment_outside_parent", "block", "This 1:1 segment runs outside its shift"));
  }
  return out;
}

export function sameDayEmploymentRule(s: RuleShift, ctx: RuleContext, batch: readonly RuleShift[]): Finding[] {
  if (up(s.code) !== "SEI" || !s.clientId) return [];
  const hit = othersOf(s, ctx, batch).find((o) =>
    o.clientId === s.clientId && dayOf(o) === dayOf(s) && ["SEE", "SJD"].includes(up(o.code)));
  return hit
    ? [find("sei_with_see_sjd", "block",
        `${firstName(clientOf(ctx, s)?.name)} already has ${up(hit.code)} that day, which can't be billed with SEI`)]
    : [];
}

function groupRatios(s: RuleShift, ctx: RuleContext): Array<{ ratio: Ratio }> {
  return (s.groupClientIds ?? []).map((id) => {
    const entry = ctx.clients[id]?.ratios?.find((r) => up(r.code) === up(s.code));
    const r = entry ?? defaultRatio(s.code, { place: s.place === "staff_home" ? "staff_home" : "facility", groupSize: s.groupClientIds?.length });
    return { ratio: r ? { staff: r.staff, clients: r.clients } : { staff: 1, clients: 6 } };
  });
}

export function groupRules(s: RuleShift, ctx: RuleContext): Finding[] {
  if (!s.groupClientIds?.length) return [];
  const out: Finding[] = [];
  const need = staffNeeded(groupRatios(s, ctx));
  if (s.groupStaffCount !== undefined && s.groupStaffCount < need) {
    out.push(find("group_over_ratio", "block",
      `${s.groupClientIds.length} clients need ${need} staff but ${s.groupStaffCount} ${s.groupStaffCount === 1 ? "is" : "are"} scheduled`,
      { label: "Add a staff member" }));
  }
  const cap = s.teamId ? ctx.places?.[s.teamId]?.licensedCapacity : null;
  if (cap != null && s.groupClientIds.length > cap) {
    out.push(find("over_licensed_capacity", "block",
      `${s.groupClientIds.length} clients is over the licensed capacity of ${cap}`));
  }
  return out;
}

export function hourCapRules(s: RuleShift, ctx: RuleContext, batch: readonly RuleShift[]): Finding[] {
  const out: Finding[] = [];
  const staff = staffOf(ctx, s);
  const code = up(s.code);
  if ((code === "CMP" || code === "CMS") && staff && !s.parentShiftId) {
    const mine = [s, ...othersOf(s, ctx, batch).filter((o) =>
      o.staffId === s.staffId && ["CMP", "CMS"].includes(up(o.code)) && !o.parentShiftId)];
    const day = sumHours(mine.filter((o) => dayOf(o) === dayOf(s)));
    const week = sumHours(mine.filter((o) => weekOf(o) === weekOf(s)));
    if (day > 8) out.push(find("cmp_cms_over_8h_day", "block", `${firstName(staff.name)} would have ${day.toFixed(1)} hours of ${code} that day (max 8)`));
    if (week > 40) out.push(find("cmp_cms_over_40h_week", "block", `${firstName(staff.name)} would have ${week.toFixed(1)} hours of ${code} that week, Sun to Sat (max 40)`));
  }
  if (code === "ELS" && s.clientId) {
    const client = clientOf(ctx, s);
    const day = sumHours([s, ...othersOf(s, ctx, batch).filter((o) => o.clientId === s.clientId && up(o.code) === "ELS" && dayOf(o) === dayOf(s))]);
    if (day > 6) out.push(find("els_over_6h_day", "block", `ELS would be ${day.toFixed(1)} hours that day (max 6) (§10.7)`));
    if (client?.elsDaysUsed !== undefined && client.elsDaysUsed >= 260) {
      out.push(find("els_over_260_days", "block", `${firstName(client.name)} has used all 260 ELS days this year (§10.4(3))`));
    }
    if (client?.absenceDaysLeft !== undefined && client.absenceDaysLeft > 0) {
      out.push(find("els_absence_days_left", "block",
        `${firstName(client.name)} still has ${client.absenceDaysLeft} absence days to use before ELS (§10.4(2))`));
    }
  }
  return out;
}
