// Contract rules for every DHHS91172 code, part 2: respite places, behavior
// consults, host homes and PPS, RHS, supported employment, EPR, day supports,
// TFB and ELS by host staff. Block unless marked warn.
import type { Finding, RuleContext, RuleShift } from "./rules-types.ts";
import {
  clientOf, dayOf, find, firstName, hoursOf, othersOf, staffOf, sumHours, up, weekOf,
} from "./rules-util.ts";

type Batch = readonly RuleShift[];

const RESPITE_RATIO: Record<string, { cite: string }> = {
  RP2: { cite: "§22.3(1)" },
  RP3: { cite: "§23.3(2)" },
  RP4: { cite: "§24.3(1)" },
  RP5: { cite: "§25.3(2)" },
};

export function respiteRules(s: RuleShift, ctx: RuleContext): Finding[] {
  const code = up(s.code);
  const client = clientOf(ctx, s);
  const staff = staffOf(ctx, s);
  const out: Finding[] = [];
  const spec = RESPITE_RATIO[code];
  if (spec && s.groupClientIds?.length) {
    const n = s.groupClientIds.length;
    if (s.place === "staff_home") {
      const total = n + (staff?.householdUnder14 ?? 0);
      if (total > 3) out.push(find("respite_staff_home_over_1_3", "block",
        `${code} in a staff home is 1:3 counting the staff member's own children and others under 14; this is ${total} (${spec.cite})`));
    } else if (s.place === "facility" && n / Math.max(1, s.groupStaffCount ?? 1) > 6) {
      out.push(find("respite_facility_over_1_6", "block", `${code} in a facility is 1:6; this is ${n} for ${s.groupStaffCount ?? 1} staff (${spec.cite})`));
    }
  }
  if (["RP4", "RP5", "RPS"].includes(code) && s.place === "client_home") {
    const cite = { RP4: "§24.4(2)", RP5: "§25.4(2)", RPS: "§26.4(1)" }[code]!;
    out.push(find("respite_in_client_home", "block", `${code} can't be given in the client's own home (${cite})`));
  }
  if (code === "RPS" && (s.place === "relative_home" || s.place === "staff_home")) {
    out.push(find("rps_relative_or_staff_home", "block", "RPS can't be given in a relative's or staff member's home (§26.4(2),(3))"));
  }
  if ((code === "RP3" || code === "RP5") && client && !client.hasForm929) {
    out.push(find("respite_no_form_929", "block",
      `${firstName(client.name)} needs Form 929 on file before ${code} (${code === "RP3" ? "§23.3(1)" : "§25.3(1)"})`));
  }
  return out;
}

export function behaviorConsultRule(s: RuleShift): Finding[] {
  const code = up(s.code);
  if (!["BC1", "BC2", "BC3"].includes(code)) return [];
  const out: Finding[] = [];
  if (s.directSupport) out.push(find("bc_direct_support", "block", `${code} can't include direct support (§3.5(2))`));
  if (s.transport) out.push(find("bc_transport", "block", `${code} can't include transporting the client (§3.5(3))`));
  return out;
}

export function hostHomeRules(s: RuleShift, ctx: RuleContext): Finding[] {
  const code = up(s.code);
  const client = clientOf(ctx, s);
  if (!client || !["HHS", "PPS"].includes(code)) return [];
  const out: Finding[] = [];
  const hh = code === "HHS";
  const sec = hh ? "§11" : "§20";
  if (hh && client.age !== null && client.age < 18) out.push(find("hhs_under_18", "block", `${firstName(client.name)} is under 18; HHS is for adults (§11.2(1))`));
  if (!hh && client.age !== null && client.age >= 22) out.push(find("pps_22_or_older", "block", `${firstName(client.name)} is 22 or older; PPS is for under 22 (§20.1)`));
  if ((client.homeClientCount ?? 1) > 1 && !client.homeException) {
    out.push(find("host_home_one_client", "block", `${code} allows one client per home unless an exception is on file (${sec}.3(7))`));
  }
  const other = hh ? "PPS" : "HHS";
  if (client.homeHasOtherCodeClients === other && !client.homeException) {
    out.push(find("hhs_pps_same_home", "block", "HHS and PPS clients can't share a home (§11.4(4))"));
  }
  if (s.respite === "own_home") {
    if ((client.respiteDaysOwnHome ?? 0) + 1 > 21) out.push(find("host_respite_over_21", "block", `Respite in the home would be day ${(client.respiteDaysOwnHome ?? 0) + 1} this Plan Year (max 21) (${sec}.3(7)(D))`));
    if ((s.respiteConsecutiveDay ?? 0) > 14) out.push(find("host_respite_over_14_consecutive", "block", `Respite in the home would be day ${s.respiteConsecutiveDay} in a row (max 14) (${sec}.3(7)(D))`));
  }
  if (s.respite === "other_home" && (client.respiteDaysOtherHome ?? 0) + 1 > 20) {
    out.push(find("host_respite_other_home_over_20", "block", `Respite in another home would be day ${(client.respiteDaysOtherHome ?? 0) + 1} this Plan Year (max 20) (${sec}.4(9))`));
  }
  return out;
}

export function residentialRule(s: RuleShift, ctx: RuleContext): Finding[] {
  const client = clientOf(ctx, s);
  return up(s.code) === "RHS" && client?.livesWithRelativeOrGuardian
    ? [find("rhs_lives_with_relative", "block", `${firstName(client.name)} lives with a relative or guardian, so RHS can't be billed (§21.4(1))`)]
    : [];
}

export function employmentRules(s: RuleShift, ctx: RuleContext, batch: Batch): Finding[] {
  const code = up(s.code);
  const client = clientOf(ctx, s);
  const out: Finding[] = [];
  if (code === "SED" && s.groupClientIds) {
    const n = s.groupClientIds.length;
    if (n < 2 || n > 8) out.push(find("sed_group_size", "block", `An SED work group is 2 to 8 people; this one is ${n} (§28.2(1))`));
  }
  if (code === "SJD" && client) {
    if (client.age !== null && client.age < 14) out.push(find("sjd_under_14", "block", `${firstName(client.name)} is under 14; SJD isn't allowed (§33.4(2))`));
    const limit = client.sjdExtendedApproval ? 120 : 80;
    if ((client.sjdHoursUsed ?? 0) + hoursOf(s) > limit) {
      out.push(find("sjd_over_hours", "block", `SJD would pass ${limit} hours for ${firstName(client.name)} (${client.sjdExtendedApproval ? "120 with approval" : "80 without approval"}) (§33.4(4))`));
    }
  }
  if (code === "SEI" && s.telehealth && client) {
    const inPerson = othersOf(s, ctx, batch).some((o) => o.clientId === s.clientId && up(o.code) === "SEI" && !o.telehealth && dayOf(o) === dayOf(s));
    if (!inPerson) out.push(find("sei_telehealth_alone", "warn", "SEI by telehealth is only allowed combined with in-person support (§30.2(1)(E))"));
  }
  return out;
}

export function eprRules(s: RuleShift, ctx: RuleContext): Finding[] {
  const client = clientOf(ctx, s);
  if (up(s.code) !== "EPR" || !client) return [];
  const out: Finding[] = [];
  if (client.eprCommunityShare != null && client.eprCommunityShare < 0.2) {
    out.push(find("epr_under_20_community", "warn", `${firstName(client.name)}'s EPR is ${Math.round(client.eprCommunityShare * 100)}% in the community this month (at least 20%) (§9.3(1))`));
  }
  if ((client.eprMonthsServed ?? 0) >= 24 && !client.eprExtensionApproved) {
    out.push(find("epr_over_24_months", "block", `${firstName(client.name)} has had EPR for 24 months in a row (§9.4(2))`));
  }
  return out;
}

export function daySupportRules(s: RuleShift, ctx: RuleContext, batch: Batch): Finding[] {
  const code = up(s.code);
  const out: Finding[] = [];
  if (code === "DSP" && s.clientId) {
    const day = sumHours([s, ...othersOf(s, ctx, batch).filter((o) => o.clientId === s.clientId && up(o.code) === "DSP" && dayOf(o) === dayOf(s))]);
    if (day > 10) out.push(find("dsp_over_10h", "block", `DSP would be ${day.toFixed(1)} hours that day (max 10) (§7.6(b))`));
  }
  if (code === "DSI" && s.clientId) {
    const week = [s, ...othersOf(s, ctx, batch).filter((o) => o.clientId === s.clientId && up(o.code) === "DSI" && weekOf(o) === weekOf(s))];
    const total = sumHours(week);
    const site = sumHours(week.filter((o) => o.place === "site" || o.place === "facility"));
    if (total > 0 && site / total > 0.5) {
      out.push(find("dsi_mostly_site_based", "warn", "DSI is mostly site-based this week (Sun to Sat); it should be mostly community (§8.4(5))"));
    }
  }
  if (code === "DSG" && (s.place === "client_home" || s.place === "staff_home")) {
    out.push(find("dsg_in_home", "block", `DSG can't be given ${s.place === "client_home" ? "in the client's home" : "in a staff home"} (§7.4)`));
  }
  return out;
}

const RESIDENTIAL_FOR_TFB = ["RHS", "HHS", "PPS", "SLH"];

export function tfbAndElsRules(s: RuleShift, ctx: RuleContext, batch: Batch): Finding[] {
  const code = up(s.code);
  const client = clientOf(ctx, s);
  const staff = staffOf(ctx, s);
  const out: Finding[] = [];
  if (code === "TFB" && client && !client.tfbDirectorApproval) {
    const has = (client.otherCodes ?? []).some((c) => RESIDENTIAL_FOR_TFB.includes(up(c))) ||
      othersOf(s, ctx, batch).some((o) => o.clientId === s.clientId && RESIDENTIAL_FOR_TFB.includes(up(o.code)));
    if (has) out.push(find("tfb_with_residential", "block", `TFB for ${firstName(client.name)} needs the Director's written approval alongside RHS, HHS, PPS or SLH (§36.3(1))`));
  }
  if (code === "ELS" && staff?.isHostStaff && client && !client.elsHostConditionsOnFile) {
    out.push(find("els_host_staff_conditions", "block", `${firstName(staff.name)} can only deliver ELS with the 4 documented conditions on file (§10.4(4))`));
  }
  return out;
}
