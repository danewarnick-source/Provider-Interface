// Reads a USTEPS-printed PCSP by its fixed labels. No AI.
// Input: pages of positioned text lines (layout.ts). Output: structured plan
// plus a list of issues for a person to review. Anything the reader can't
// place is reported, never guessed.

import type { LayoutPage } from "./layout.ts";
import { readGoals } from "./parser-goals.ts";
import { runChecks } from "./parser-checks.ts";
import {
  indent, longDate, ourAgencyMatcher, SECTIONS, squash, usDate,
  type Issue, type L, type PcspOptions, type PcspResult,
} from "./parser-shared.ts";
import {
  readAboutMe, readBudget, readLastYearGoals, readMeetingMinutes, readNonGoalSupports,
  readPerson, readPurchasedServices, readRisks,
} from "./parser-tables.ts";

const FOOTER = /^(Report Printed:|Plan Status:|Plan Activated:)/;

export type PcspSection = { name: string; lines: L[] };

/** Strip each page's header/footer; skip the overlapped part of a page printed on top of itself. */
function pageBodies(pages: LayoutPage[], res: PcspResult, issues: Issue[]): L[] {
  const body: L[] = [];
  for (const p of pages) {
    const lines = p.lines.map((l) => ({ page: p.index, y: l.y, text: l.text }));
    if (!lines.length) continue;
    let garbled = false;
    for (const l of lines) {
      const t = l.text.trim();
      if (t.startsWith("Plan Activated:")) {
        const d = longDate(t);
        if (d && !res.plan.activatedOn) res.plan.activatedOn = d;
        if (/Plan Activated:\s+[A-Z][a-z]+:/.test(t) || /Activated:.*(Strengths|Goal|Support):/.test(t)) garbled = true;
      }
      if (t.startsWith("Plan Status:") && !res.plan.status) res.plan.status = squash(t.replace("Plan Status:", ""));
    }
    const start = /Person Centered Support Plan \(PCSP/.test(lines[0].text) ? 1 : 0;
    let keep = lines.slice(start);
    if (garbled) {
      // Keep the readable top of the page; drop everything from the point where a second copy
      // of the page restarts (a repeated section heading partway down) or, failing that, the whole page.
      const heads = keep.map((l, i) => (SECTIONS.includes(l.text.trim()) ? i : -1)).filter((i) => i >= 0);
      const cut = heads.length > 1 ? heads[1] : 0;
      keep = keep.slice(0, cut);
      issues.push({ level: "warn", page: p.index, message: cut
        ? "The bottom of this page is printed on top of itself. The readable top part was used; the overlapping part was skipped. Check it by eye."
        : "This page's text is printed on top of itself and was skipped. Check it by eye." });
    }
    for (const l of keep) if (!FOOTER.test(l.text.trim())) body.push(l);
  }
  return body;
}

/** Split body lines into sections by their fixed headings. */
function splitSections(body: L[]): PcspSection[] {
  const sections: PcspSection[] = [];
  let cur: PcspSection = { name: "Cover", lines: [] };
  for (const l of body) {
    const t = l.text.trim();
    if (SECTIONS.includes(t) && indent(l.text) < 12) {
      if (t === cur.name) continue; // repeated heading at the top of a continued page
      sections.push(cur);
      cur = { name: t, lines: [] };
      continue;
    }
    if (t === "Domains") continue;
    cur.lines.push(l);
  }
  sections.push(cur);
  return sections;
}

function emptyResult(): PcspResult {
  return {
    plan: { start: null, end: null, activatedOn: null, status: null, meetingDate: null },
    person: { name: "", pid: "", residentialAddress: "", mailingAddress: "", phone: "", supportCoordinator: { name: "", email: "", phone: "", company: "" } },
    goals: [], nonGoalSupports: [], purchasedServices: [], budget: [], risks: [], aboutMe: [], lastYearGoals: [], issues: [],
  };
}

/** The parse plus the sections it was read from (the Nectar fallback needs a section's text). */
export function readPcspPages(pages: LayoutPage[], opts: PcspOptions): { result: PcspResult; sections: PcspSection[] } {
  const res = emptyResult();
  const { issues } = res;
  const isOurs = ourAgencyMatcher(opts.agencyName);
  const body = pageBodies(pages, res, issues);

  // Plan dates from the cover line "09/01/2026 - 08/31/2027".
  for (const l of body.slice(0, 15)) {
    const m = l.text.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
    if (m) { res.plan.start = usDate(m[1]); res.plan.end = usDate(m[2]); break; }
  }

  const sections = splitSections(body);
  const get = (name: string) => sections.filter((s) => s.name === name).flatMap((s) => s.lines);

  readPerson(get("Personal Information"), res.person);
  readMeetingMinutes(get("Plan Meeting Minutes"), res.plan);
  res.goals = readGoals(get("Goals and Supports"), isOurs, issues);
  res.nonGoalSupports = readNonGoalSupports(get("Non Goal Supports"));
  res.purchasedServices = readPurchasedServices(get("DSPD Purchased Services"), issues);
  res.budget = readBudget(get("Plan Budget"), isOurs, issues);
  res.risks = readRisks(get("List of Identified Risks"));
  res.aboutMe = readAboutMe(get("Action Plan"));
  res.lastYearGoals = readLastYearGoals(get("Annual Review for Goals"));
  runChecks(res, opts);
  return { result: res, sections };
}

export function parsePcsp(pages: LayoutPage[], opts: PcspOptions): PcspResult {
  return readPcspPages(pages, opts).result;
}
