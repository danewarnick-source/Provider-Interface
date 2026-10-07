// The PCSP's table-like sections: person, meeting minutes, non-goal supports,
// DSPD purchased services, plan budget, risks, action plan ("about me") and
// last year's goals. Each reader takes that section's lines.

import {
  addProviderTo, DOMAINS, noteObsolete, parseProvider, readFields, squash, supportDates, usDate,
  type AboutMeRow, type BudgetLine, type Issue, type L, type LastYearGoal,
  type NonGoalSupport, type PcspResult, type PurchasedService, type Risk,
} from "./parser-shared.ts";

export function readPerson(lines: L[], person: PcspResult["person"]): void {
  let inSc = false;
  for (const x of readFields(lines)) {
    if (x.label === "Support Coordinator") { inSc = true; continue; }
    if (!inSc) {
      if (x.label === "Legal Name") person.name = x.value;
      if (x.label === "PID") person.pid = x.value;
      if (x.label === "Mailing Address") person.mailingAddress = x.value;
      if (x.label === "Residential Address") person.residentialAddress = x.value;
      if (x.label === "Phone") person.phone = x.value;
    } else {
      if (x.label === "Name") {
        const email = x.value.match(/\S+@\S+/)?.[0] || "";
        person.supportCoordinator.name = squash(x.value.replace(email, ""));
        person.supportCoordinator.email = email;
      }
      if (x.label === "Phone") person.supportCoordinator.phone = x.value;
      if (x.label === "Company") person.supportCoordinator.company = x.value;
    }
  }
}

export function readMeetingMinutes(lines: L[], plan: PcspResult["plan"]): void {
  for (const x of readFields(lines)) {
    if (x.label === "Meeting Date") plan.meetingDate = usDate(x.value);
    if (x.label === "Effective Start Date" && !plan.start) plan.start = usDate(x.value);
    if (x.label === "Effective End Date" && !plan.end) plan.end = usDate(x.value);
  }
}

export function readNonGoalSupports(lines: L[], isOurs: (provider: string) => boolean): NonGoalSupport[] {
  const out: NonGoalSupport[] = [];
  let cur: NonGoalSupport | null = null;
  for (const x of readFields(lines)) {
    if (x.label === "Support") {
      cur = { support: x.value, details: "", start: null, end: null, providers: [], ourCodes: [] };
      out.push(cur);
    } else if (cur && x.label === "Support Details") cur.details = x.value;
    else if (cur && x.label === "Support Dates") Object.assign(cur, supportDates(x.value));
    else if (cur && x.label === "Paid Provider") {
      const p = parseProvider(x.value, isOurs);
      if (p) addProviderTo(cur, p);
    }
  }
  return out;
}

/** "BC2   Behavior Consultation II", "HHS Host Home Support" or "SLN - Supported Living". */
const SERVICE_HEAD = /^([A-Z][A-Z0-9]{1,3})(?:\s*-\s*|\s+)([A-Z][^:]*[a-z][^:]*)$/;
const SERVICE_FIELD = /^(Type|Amount|Duration|Frequency):\s+(.*)$/;

/** Code heading, then Type / Amount / Duration lines. */
export function readPurchasedServices(lines: L[], issues: Issue[]): PurchasedService[] {
  const out: PurchasedService[] = [];
  let svc: PurchasedService | null = null;
  for (const l of lines) {
    const t = l.text.trim();
    if (/obsolete/i.test(t)) { noteObsolete(t, l.page, issues); continue; }
    const head = t.match(SERVICE_HEAD);
    if (head) {
      svc = { code: head[1], name: head[2].trim(), unitType: "", units: null, start: null, end: null, page: l.page };
      out.push(svc);
      continue;
    }
    const m = t.match(SERVICE_FIELD);
    if (!m) continue;
    // A second "Type:" starts another entry: a reprint on the next page, or a service whose code line is missing.
    if (!svc || (m[1] === "Type" && svc.unitType)) {
      svc = { code: "", name: "", unitType: "", units: null, start: null, end: null, page: l.page };
      out.push(svc);
    }
    if (m[1] === "Type") svc.unitType = m[2].trim();
    if (m[1] === "Amount") svc.units = Number((m[2].match(/(\d+)/) || [])[1] ?? NaN);
    if (m[1] === "Duration") {
      const d = m[2].match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
      if (d) { svc.start = usDate(d[1]); svc.end = usDate(d[2]); }
    }
  }
  return settleCodeless(out, issues);
}

/**
 * Entries read without a code: a service continued across a page break is
 * folded back into it (a full reprint is dropped; the rest of a service cut
 * off at the bottom of a page fills it in). Only an entry whose units and
 * dates belong to no coded service is reported.
 */
function settleCodeless(list: PurchasedService[], issues: Issue[]): PurchasedService[] {
  const coded = list.filter((s) => s.code);
  const out: PurchasedService[] = [];
  for (const s of list) {
    if (s.code) { out.push(s); continue; }
    const reprint = s.units != null && coded.some((c) =>
      c.units === s.units && c.start === s.start && c.end === s.end && (!s.unitType || !c.unitType || c.unitType === s.unitType));
    if (reprint) continue;
    const prev = out[out.length - 1];
    if (prev?.code && prev.page < s.page && (prev.units == null || !prev.start)) {
      prev.unitType ||= s.unitType;
      if (prev.units == null) prev.units = s.units;
      if (!prev.start) { prev.start = s.start; prev.end = s.end; }
      continue;
    }
    out.push(s);
    issues.push({ level: "error", page: s.page, message: "A purchased service is listed without its code (the code line is missing in the PDF). Enter the code by hand." });
  }
  return out;
}

const BUDGET_ROW =
  /^\s*([A-Z][A-Z0-9]{1,3})\s+([A-Z])\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\S+)\s+\$([\d,.]+)\s+(\d+)\s+(\d+)\s+\$([\d,.]+)/;

/** Rows: CODE KIND START END ELIG $RATE MAX UNITS $TOTAL. The provider name wraps above/below. */
export function readBudget(lines: L[], isOurs: (provider: string) => boolean, issues: Issue[]): BudgetLine[] {
  const out: BudgetLine[] = [];
  lines.forEach((l, i) => {
    const m = l.text.match(BUDGET_ROW);
    if (!m) {
      if (/obsolete/i.test(l.text)) noteObsolete(l.text, l.page, issues);
      return;
    }
    const provider = squash(
      [lines[i - 1]?.text, lines[i + 1]?.text].filter((x) => x && !/\d{2}\/\d{2}\/\d{4}/.test(x) && !/\$/.test(x)).join(" "),
    );
    out.push({
      code: m[1], kind: m[2], provider, ours: isOurs(provider), start: usDate(m[3])!, end: usDate(m[4])!,
      rate: Number(m[6].replace(/,/g, "")), maxMonthlyUnits: Number(m[7]), annualUnits: Number(m[8]),
      total: Number(m[9].replace(/,/g, "")),
    });
  });
  return out;
}

export function readRisks(lines: L[]): Risk[] {
  const out: Risk[] = [];
  let r: Risk | null = null;
  let notesPrefix = "";
  for (const x of readFields(lines)) {
    if (x.label === "Identified Risk") { r = { risk: x.value, response: "", responseTime: "", notes: "" }; out.push(r); notesPrefix = ""; }
    else if (r && x.label === "Response") r.response = x.value;
    else if (r && x.label === "Response Time") {
      // The Notes label sits in the middle of its text, so overflow under Response Time belongs to Notes.
      const [first, ...rest] = x.value.split(/\s+/);
      r.responseTime = first;
      notesPrefix = rest.join(" ");
    } else if (r && x.label === "Notes") { r.notes = squash(notesPrefix + " " + x.value); notesPrefix = ""; }
  }
  return out;
}

/** Action plan rows (Label | Note | Category | From), by column position. */
export function readAboutMe(lines: L[]): AboutMeRow[] {
  const out: AboutMeRow[] = [];
  let domain = "";
  let cols: { note: number; cat: number; from: number } | null = null;
  let row: AboutMeRow | null = null;
  for (const l of lines) {
    const t = l.text.trim();
    if (DOMAINS.includes(t)) { domain = t; row = null; continue; }
    if (/^Label\s+Note\s+Category\s+From$/.test(t)) {
      cols = { note: l.text.indexOf("Note"), cat: l.text.indexOf("Category"), from: l.text.indexOf("From") };
      row = null;
      continue;
    }
    if (!cols) continue;
    const slice = (a: number, b: number) => l.text.slice(Math.max(0, a), b).trim();
    const label = slice(0, cols.note - 1), note = slice(cols.note - 1, cols.cat - 1);
    const cat = slice(cols.cat - 1, cols.from - 1), from = slice(cols.from - 1, 999);
    if (cat && from) { row = { domain, label, note, source: from }; out.push(row); }
    else if (row) {
      if (label) row.label = squash(row.label + " " + label);
      if (note) row.note = squash(row.note + " " + note);
    }
  }
  return out;
}

/** Last year's goals with "Ongoing Goal for New Plan? Y/N", for carry-over matching. */
export function readLastYearGoals(lines: L[]): LastYearGoal[] {
  const found: (LastYearGoal & { idx: number })[] = [];
  let g: (LastYearGoal & { idx: number }) | null = null;
  for (const x of readFields(lines)) {
    if (x.label === "Goal") { g = { goal: x.value, ongoing: null, status: "", idx: x.idx }; found.push(g); }
    else if (g && x.label === "Goal Status") g.status = x.value;
  }
  // "Ongoing Goal for New Plan?   Y" has no colon, so read it directly.
  lines.forEach((l, idx) => {
    const m = l.text.match(/Ongoing Goal for New Plan\?\s+([YN])/);
    if (!m) return;
    const owner = [...found].reverse().find((x) => x.idx < idx);
    if (owner) owner.ongoing = m[1] === "Y";
  });
  return found.map(({ goal, ongoing, status }) => ({ goal, ongoing, status }));
}
