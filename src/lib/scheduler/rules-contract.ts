// Contract rules for every DHHS91172 code, part 1: absences, custody, asleep time,
// supported living and respite, the SLN/CMP/CMS relationship, MTP, and nursing.
// Block unless marked warn. Each finding cites its section.
import { billingFor } from "./billing-mode.ts";
import { SCHEDULER_TIME_ZONE, dayKey } from "./time.ts";
import type { Finding, RuleContext, RuleShift } from "./rules-types.ts";
import {
  clientOf, dayOf, find, firstName, hoursOf, minutesOf, othersOf, staffOf, sumHours, up, weekOf,
} from "./rules-util.ts";

type Batch = readonly RuleShift[];

/** Hospital inpatient (admission day blocked, discharge day allowed) or jail (§2.1(5)(A),(K)). */
export function absenceRule(s: RuleShift, ctx: RuleContext): Finding[] {
  const client = clientOf(ctx, s);
  if (!client) return [];
  const day = dayOf(s);
  for (const a of client.absences ?? []) {
    if (a.kind === "hospital" && day >= a.startDate && (a.endDate === null || day < a.endDate)) {
      return [find("client_in_hospital", "block", `${firstName(client.name)} is in the hospital on ${day} (§2.1(5)(A))`)];
    }
    if (a.kind === "jail" && day >= a.startDate && (a.endDate === null || day <= a.endDate)) {
      return [find("client_in_jail", "block", `${firstName(client.name)} is in jail on ${day} (§2.1(5)(K))`)];
    }
  }
  return [];
}

const CUSTODY_BARRED: Record<string, { cite: string; djjys: boolean }> = {
  COM: { cite: "§6.4(3)", djjys: true },
  HSQ: { cite: "§12.3(2)", djjys: true },
  SLH: { cite: "§31.4(2)", djjys: false },
  SLN: { cite: "§32.4(2)", djjys: false },
  CMP: { cite: "§32.4(2)", djjys: false },
  CMS: { cite: "§32.4(2)", djjys: false },
  RP2: { cite: "§22.4(1)", djjys: false },
  RP3: { cite: "§23.4(1)", djjys: false },
  RP4: { cite: "§24.4(1)", djjys: false },
  RP5: { cite: "§25.4(1)", djjys: false },
  TFB: { cite: "§36.3(3)", djjys: false },
};

export function custodyRule(s: RuleShift, ctx: RuleContext): Finding[] {
  const client = clientOf(ctx, s);
  const bar = CUSTODY_BARRED[up(s.code)];
  if (!client || !bar || !client.custody || client.custody === "none") return [];
  if (client.custody === "dcfs" || bar.djjys) {
    const who = client.custody === "dcfs" ? "DCFS" : "DJJYS";
    return [find("custody_barred_code", "block", `${up(s.code)} can't be billed for ${firstName(client.name)} (${who} custody) (${bar.cite})`)];
  }
  return [];
}

function localHour(iso: string): number {
  return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: SCHEDULER_TIME_ZONE }).format(new Date(iso)));
}

/** Asleep time is not billable on SLH/SLN/CMP/CMS (§31.4(4), §32.4(6)). Warn. */
export function asleepRule(s: RuleShift): Finding[] {
  const code = up(s.code);
  if (!["SLH", "SLN", "CMP", "CMS"].includes(code)) return [];
  const dur = hoursOf(s);
  const sh = localHour(s.startsAt), eh = localHour(s.endsAt);
  const overnight = sh >= 23 || sh < 6 || eh >= 23 || eh < 6 || dur >= 8 || dayKey(s.startsAt) !== dayKey(new Date(new Date(s.endsAt).getTime() - 1));
  if (!overnight || s.awakeConfirmed) return [];
  if (s.awakeMinutes != null && s.awakeMinutes >= minutesOf(s)) return [];
  return [find("asleep_not_billable", "warn",
    `Asleep time isn't billable on ${code}; confirm who is awake overnight (${code === "SLH" ? "§31.4(4)" : "§32.4(6)"})`)];
}

function slHours(s: RuleShift, ctx: RuleContext, batch: Batch): number {
  return sumHours(othersOf(s, ctx, batch).filter((o) =>
    o.clientId === s.clientId && ["SLH", "SLN"].includes(up(o.code)) && dayOf(o) === dayOf(s) && !o.parentShiftId));
}

const RESPITE_DAILY_CITE: Record<string, string> = { RP2: "§22.4(2)", RP3: "§23.4(2)", RP4: "§24.4(3)", RP5: "§25.4(3)" };

export function supportedLivingRespiteRules(s: RuleShift, ctx: RuleContext, batch: Batch): Finding[] {
  const client = clientOf(ctx, s);
  const code = up(s.code);
  if (!client) return [];
  const out: Finding[] = [];
  if (["SLH", "SLN"].includes(code) && client.overnightRespiteDays?.includes(dayOf(s))) {
    const total = slHours(s, ctx, batch) + hoursOf(s);
    if (total > 4) {
      out.push(find("sl_with_overnight_respite", "block",
        `${firstName(client.name)} has overnight respite that day, so ${code} is limited to 4 hours (${code === "SLH" ? "§31.4(3)" : "§32.4(3)"})`));
    }
  }
  if (RESPITE_DAILY_CITE[code]) {
    const same = [s, ...othersOf(s, ctx, batch).filter((o) => o.clientId === s.clientId && up(o.code) === code && dayOf(o) === dayOf(s))];
    const daily = billingFor(code, same.map(minutesOf), dayOf(s)).unitType === "day";
    if (daily && slHours(s, ctx, batch) > 4) {
      out.push(find("respite_daily_over_4h_sl", "block",
        `${code} can't bill the daily rate on a day ${firstName(client.name)} has over 4 hours of Supported Living (${RESPITE_DAILY_CITE[code]})`));
    }
  }
  return out;
}

const REL_CODE = { parent: "CMP", step_parent: "CMP", guardian: "CMP", spouse: "CMS", other: "SLN" } as const;

/** SLN/CMP/CMS follow the staff relationship (§32.6). */
export function relationshipCodeRule(s: RuleShift, ctx: RuleContext): Finding[] {
  const code = up(s.code);
  const staff = staffOf(ctx, s);
  const client = clientOf(ctx, s);
  if (!["SLN", "CMP", "CMS"].includes(code) || !staff || !client) return [];
  const rel = staff.relationTo?.[client.id] ?? "other";
  const want = REL_CODE[rel];
  if (want === code) return [];
  const who = firstName(staff.name), cl = firstName(client.name);
  const why = rel === "other" ? `${who} isn't ${cl}'s parent, guardian or spouse` : `${who} is ${cl}'s ${rel.replace("_", "-")}`;
  return [find("wrong_natural_supports_code", "block", `${why}, so use ${want}, not ${code} (§32.6)`,
    { label: `Use ${want}`, code: want })];
}

const MTP_DAY_CODES = ["DSG", "DSP", "EPR", "SED"];

export function mtpRules(s: RuleShift, ctx: RuleContext, batch: Batch): Finding[] {
  if (up(s.code) !== "MTP" || !s.clientId) return [];
  const client = clientOf(ctx, s);
  const sameDay = othersOf(s, ctx, batch).filter((o) => o.clientId === s.clientId && dayOf(o) === dayOf(s));
  const out: Finding[] = [];
  if (sameDay.some((o) => up(o.code) === "DSI")) {
    out.push(find("mtp_with_dsi", "block", "MTP can't be billed with DSI; transportation is part of DSI (§8.4(4))"));
  } else if (!sameDay.some((o) => MTP_DAY_CODES.includes(up(o.code)))) {
    out.push(find("mtp_needs_day_support", "block", "MTP needs DSG, DSP, EPR or SED the same day (§13.1, §9.2(7), §28.2(5))"));
  }
  if (client && client.mtpDaysBilled !== undefined && client.dayServiceDaysBilled !== undefined &&
      client.mtpDaysBilled >= client.dayServiceDaysBilled) {
    out.push(find("mtp_days_over_day_support_days", "block",
      `${firstName(client.name)} would have more MTP days than day-support days this month (§13.4(3))`));
  }
  return out;
}

const PN = ["PN1", "PN2"];

export function nursingRules(s: RuleShift, ctx: RuleContext, batch: Batch): Finding[] {
  const code = up(s.code);
  const client = clientOf(ctx, s);
  if (!client || !["PM1", "PM2", "PN1", "PN2"].includes(code)) return [];
  const out: Finding[] = [];
  const sameDay = othersOf(s, ctx, batch).filter((o) => o.clientId === s.clientId && dayOf(o) === dayOf(s));
  const hasPn = sameDay.some((o) => PN.includes(up(o.code))) || PN.some((c) => client.otherCodes?.includes(c));
  const hasPm = sameDay.some((o) => ["PM1", "PM2"].includes(up(o.code))) || ["PM1", "PM2"].some((c) => client.otherCodes?.includes(c));
  if ((code === "PM1" || code === "PM2") && hasPn) {
    out.push(find("pm_with_pn", "block", `${code} can't be billed when ${firstName(client.name)} gets PN1 or PN2 (${code === "PM1" ? "§16.3" : "§17.3"})`));
  }
  if (code === "PN1") {
    if (client.agencyIsResidentialProvider === false) out.push(find("pn1_not_residential_provider", "block", "PN1 is only for clients whose RHS, HHS, PPS or SLH the agency provides (§18.4(2))"));
    if (client.hasPn2Oversight === false) out.push(find("pn1_no_pn2_oversight", "block", "PN1 needs PN2 oversight (§18.4(1))"));
    if (hasPm) out.push(find("pn_with_pm", "block", "PN1 can't be billed with PM1 or PM2 (§18.4(3))"));
  }
  if (code === "PN2") {
    if (hasPm) out.push(find("pn_with_pm", "block", "PN2 can't be billed with PM1 or PM2 (§19.4(5))"));
    const kinds = new Set([s, ...sameDay.filter((o) => up(o.code) === "PN2")].map((o) => o.pn2Kind).filter(Boolean));
    if (kinds.has("daily") && kinds.has("session")) out.push(find("pn2_daily_and_session", "block", "PN2 can't bill the daily and session rate on the same day (§19.4(3))"));
    if (s.pn2Kind === "daily" && !s.inPerson) out.push(find("pn2_daily_needs_visit", "block", "The PN2 daily rate needs an in-person visit (§19.7)"));
    const days = new Set([s, ...othersOf(s, ctx, batch).filter((o) => o.clientId === s.clientId && up(o.code) === "PN2" && weekOf(o) === weekOf(s))].map(dayOf));
    if (days.size > 3 && !s.reason) {
      out.push(find("pn2_over_3_days", "warn", `PN2 is on ${days.size} days this week; add a reason it can't be delegated to PN1 (§19.4(2))`));
    }
  }
  return out;
}

