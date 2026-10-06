// Reads a USTEPS-printed PCSP by its fixed labels. No AI.
// Input: pages of positioned text lines (pcsp-layout.ts). Output: structured
// plan + a list of issues for a person to review. Anything the reader can't
// place is reported, never guessed.

import type { LayoutPage } from "./pcsp-layout.ts";

export type Issue = { level: "error" | "warn" | "info"; page?: number; message: string };
export type Provider = { code: string; provider: string; ours: boolean };
export type HealthNeed = { category: string; description: string };
export type Support = {
  support: string; details: string; start: string | null; end: string | null;
  providers: Provider[]; ourCodes: string[]; naturalSupport: string; otherSupport: string;
  healthNeeds: HealthNeed[]; page: number;
};
export type Goal = {
  goal: string; domain: string; currentStatus: string; strengths: string; barriers: string;
  successPerson: string; successTeam: string; supports: Support[]; page: number;
};
export type PcspResult = {
  plan: { start: string | null; end: string | null; activatedOn: string | null; status: string | null; meetingDate: string | null };
  person: { name: string; pid: string; residentialAddress: string; mailingAddress: string; phone: string;
    supportCoordinator: { name: string; email: string; phone: string; company: string } };
  goals: Goal[];
  nonGoalSupports: { support: string; details: string; start: string | null; end: string | null }[];
  purchasedServices: { code: string; name: string; unitType: string; units: number | null; start: string | null; end: string | null }[];
  budget: { code: string; kind: string; provider: string; ours: boolean; start: string; end: string; rate: number; maxMonthlyUnits: number; annualUnits: number; total: number }[];
  risks: { risk: string; response: string; responseTime: string; notes: string }[];
  aboutMe: { domain: string; label: string; note: string; source: string }[];
  lastYearGoals: { goal: string; ongoing: boolean | null; status: string }[];
  issues: Issue[];
};

type L = { page: number; y: number; text: string };

const SECTIONS = [
  "Personal Information", "Pre-Planning", "Annual Review for Goals", "Annual Review for Non Goal Supports",
  "Annual Review for Provider Services", "Planning Tools", "Plan Meeting Minutes", "Action Plan",
  "Goals and Supports", "Non Goal Supports", "DSPD Purchased Services", "Plan Budget", "Scope of Services",
  "Backup Data", "List of Identified Risks", "Emergency Contacts", "Signatures", "Plan Activation Comments",
];
const DOMAINS = ["Daily Life Employment", "Community Living", "Safety & Security", "Healthy Living",
  "Social Spirituality", "Citizenship & Advocacy"];
const FOOTER = /^(Report Printed:|Plan Status:|Plan Activated:)/;
const LABEL = /^(\s*)([A-Z][A-Za-z ()/&'?-]{1,40}?):(\s+(.*))?$/;

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\b(LLC|INC|CORP|CO)\b/g, "").replace(/\s+/g, " ").trim();
const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const usDate = (s: string | undefined | null) => {
  const m = s && s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
};
const MONTHS: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
const longDate = (s: string) => {
  const m = s.match(/([A-Z][a-z]{2})\s+(\d{1,2}),\s*(\d{4})/);
  return m ? `${m[3]}-${MONTHS[m[1]]}-${m[2].padStart(2, "0")}` : null;
};
const indent = (t: string) => t.length - t.trimStart().length;

export function parsePcsp(pages: LayoutPage[], opts: { agencyName: string; agencyCodes: string[] }): PcspResult {
  const issues: Issue[] = [];
  const res: PcspResult = {
    plan: { start: null, end: null, activatedOn: null, status: null, meetingDate: null },
    person: { name: "", pid: "", residentialAddress: "", mailingAddress: "", phone: "", supportCoordinator: { name: "", email: "", phone: "", company: "" } },
    goals: [], nonGoalSupports: [], purchasedServices: [], budget: [], risks: [], aboutMe: [], lastYearGoals: [], issues,
  };
  const agency = norm(opts.agencyName);
  const isOurs = (p: string) => norm(p).includes(agency) || agency.includes(norm(p));

  // 1. Strip each page's header and footer; flag pages whose text overlaps.
  const body: L[] = [];
  for (const p of pages) {
    const lines = p.lines.map((l) => ({ page: p.index, y: l.y, text: l.text }));
    if (!lines.length) continue;
    let garbled = false;
    for (const l of lines) {
      const t = l.text.trim();
      if (t.startsWith("Plan Activated:")) {
        const d = longDate(t); if (d && !res.plan.activatedOn) res.plan.activatedOn = d;
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

  // Plan dates from the cover line "09/01/2026 - 08/31/2027".
  for (const l of body.slice(0, 15)) {
    const m = l.text.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
    if (m) { res.plan.start = usDate(m[1]); res.plan.end = usDate(m[2]); break; }
  }

  // 2. Split into sections by their fixed headings.
  const sections: { name: string; lines: L[] }[] = [];
  let cur = { name: "Cover", lines: [] as L[] };
  for (const l of body) {
    const t = l.text.trim();
    if (SECTIONS.includes(t) && indent(l.text) < 12) {
      if (t === cur.name) continue; // repeated heading at the top of a continued page
      sections.push(cur); cur = { name: t, lines: [] };
      continue;
    }
    if (t === "Domains") continue;
    cur.lines.push(l);
  }
  sections.push(cur);
  const get = (name: string) => sections.filter((s) => s.name === name).flatMap((s) => s.lines);

  // Generic "Label: value" reader with multi-line values.
  function readFields(lines: L[]) {
    const out: { label: string; value: string; page: number; y: number; idx: number }[] = [];
    let last: { label: string; value: string; page: number; y: number; idx: number; col: number } | null = null;
    lines.forEach((l, idx) => {
      const m = l.text.match(LABEL);
      if (m && indent(l.text) < 14) {
        const col = m[4] ? l.text.indexOf(m[4], m[1].length + m[2].length) : 99;
        last = { label: m[2].trim(), value: (m[4] || "").trim(), page: l.page, y: l.y, idx, col };
        out.push(last);
      } else if (last && indent(l.text) >= Math.min(last.col, 24) - 3) {
        last.value = (last.value + " " + l.text.trim()).trim();
      } else last = null;
    });
    return out;
  }

  // 3. Person and Support Coordinator.
  {
    const f = readFields(get("Personal Information"));
    let inSc = false;
    for (const x of f) {
      if (x.label === "Support Coordinator") { inSc = true; continue; }
      if (!inSc) {
        if (x.label === "Legal Name") res.person.name = x.value;
        if (x.label === "PID") res.person.pid = x.value;
        if (x.label === "Mailing Address") res.person.mailingAddress = x.value;
        if (x.label === "Residential Address") res.person.residentialAddress = x.value;
        if (x.label === "Phone") res.person.phone = x.value;
      } else {
        if (x.label === "Name") {
          const email = x.value.match(/\S+@\S+/)?.[0] || "";
          res.person.supportCoordinator.name = squash(x.value.replace(email, ""));
          res.person.supportCoordinator.email = email;
        }
        if (x.label === "Phone") res.person.supportCoordinator.phone = x.value;
        if (x.label === "Company") res.person.supportCoordinator.company = x.value;
      }
    }
  }
  for (const x of readFields(get("Plan Meeting Minutes"))) {
    if (x.label === "Meeting Date") res.plan.meetingDate = usDate(x.value);
    if (x.label === "Effective Start Date" && !res.plan.start) res.plan.start = usDate(x.value);
    if (x.label === "Effective End Date" && !res.plan.end) res.plan.end = usDate(x.value);
  }

  // 4. Goals and Supports.
  {
    const lines = get("Goals and Supports");
    let goal: Goal | null = null;
    let sup: Support | null = null;
    let mode: "goal" | "success" | "support" | "health" = "goal";
    let field: { set: (v: string) => void; col: number } | null = null;
    let health: { left: L[]; right: L[] } = { left: [], right: [] };
    let successQ = 0;

    const flushHealth = () => {
      if (!sup || (!health.left.length && !health.right.length)) { health = { left: [], right: [] }; return; }
      // Descriptions are in the right column; a block ends at a line ending "." when the next starts uppercase.
      const blocks: { lines: L[] }[] = [];
      health.right.forEach((l, i) => {
        if (!blocks.length) blocks.push({ lines: [] });
        blocks[blocks.length - 1].lines.push(l);
        const next = health.right[i + 1];
        if (next && /\.\s*$/.test(l.text) && /^[A-Z]/.test(next.text.trim())) blocks.push({ lines: [] });
      });
      const cats: string[][] = blocks.map(() => []);
      for (const c of health.left) {
        let best = 0, bestD = Infinity;
        blocks.forEach((b, i) => {
          const ys = b.lines.filter((x) => x.page === c.page).map((x) => x.y);
          if (!ys.length) return;
          const d = c.y > Math.max(...ys) ? c.y - Math.max(...ys) : c.y < Math.min(...ys) ? Math.min(...ys) - c.y : 0;
          if (d < bestD) { bestD = d; best = i; }
        });
        if (cats[best]) cats[best].push(c.text.trim());
      }
      // A description split across two blocks leaves one without a label: merge it into the block above.
      for (let i = blocks.length - 1; i > 0; i--) {
        if (!cats[i].length) { blocks[i - 1].lines.push(...blocks[i].lines); blocks.splice(i, 1); cats.splice(i, 1); }
      }
      blocks.forEach((b, i) => {
        const category = cats[i].join(" ");
        if (!category) issues.push({ level: "warn", page: b.lines[0]?.page, message: `A health and safety need under "${sup!.support.slice(0, 50)}" has a description but no category.` });
        sup!.healthNeeds.push({ category: category || "(unlabeled)", description: squash(b.lines.map((x) => x.text).join(" ")) });
      });
      health = { left: [], right: [] };
    };

    for (const l of lines) {
      const t = l.text.trim();
      if (!t) continue;
      const m = l.text.match(LABEL);
      const lab = m && indent(l.text) < 14 ? m[2].trim() : null;
      const val = m && m[4] ? m[4].trim() : "";
      const col = m && m[4] ? l.text.indexOf(m[4], m[1].length + m[2].length) : 99;

      if (lab === "Goal") {
        if (mode === "health") flushHealth();
        if (goal && squash(val) === squash(goal.goal)) { mode = sup ? (mode === "health" ? "support" : mode) : "goal"; field = null; continue; }
        goal = { goal: val, domain: "", currentStatus: "", strengths: "", barriers: "", successPerson: "", successTeam: "", supports: [], page: l.page };
        res.goals.push(goal); sup = null; mode = "goal"; field = null; continue;
      }
      if (!goal) { issues.push({ level: "warn", page: l.page, message: `Text before the first goal was ignored: "${t.slice(0, 60)}"` }); continue; }
      if (t === "Success Criteria") { mode = "success"; field = null; successQ = 0; continue; }
      if (t === "Support Item") {
        if (mode === "health") flushHealth();
        sup = { support: "", details: "", start: null, end: null, providers: [], ourCodes: [], naturalSupport: "", otherSupport: "", healthNeeds: [], page: l.page };
        goal.supports.push(sup); mode = "support"; field = null; continue;
      }
      if (t === "Addressed Health and Safety Needs") { mode = "health"; field = null; continue; }

      if (mode === "health") {
        // Two columns: category on the left, description from about column 45 on. A line can hold both.
        const RC = 45;
        const leftPart = l.text.slice(0, RC).trim(), rightPart = l.text.slice(RC).trim();
        if (leftPart && rightPart && l.text[RC - 1] !== " " && l.text[RC] !== " ") {
          // a word straddles the split: treat the whole line by its indent
          if (indent(l.text) < 30) health.left.push(l); else health.right.push(l);
        } else {
          if (leftPart) health.left.push({ ...l, text: leftPart });
          if (rightPart) health.right.push({ ...l, text: " ".repeat(RC) + rightPart });
        }
        continue;
      }
      if (mode === "success") {
        if (/\?$/.test(t)) { successQ++; continue; }
        if (successQ === 1) goal.successPerson = squash(goal.successPerson + " " + t);
        else if (successQ >= 2) goal.successTeam = squash(goal.successTeam + " " + t);
        continue;
      }
      if (lab) {
        const g = goal, s = sup;
        const setters: Record<string, (v: string) => void> = mode === "goal" ? {
          "Goal Domain": (v) => (g.domain = squash(g.domain + " " + v)),
          "Current Status": (v) => (g.currentStatus = squash(g.currentStatus + " " + v)),
          "Strengths": (v) => (g.strengths = squash(g.strengths + " " + v)),
          "Barriers": (v) => (g.barriers = squash(g.barriers + " " + v)),
        } : s ? {
          "Support": (v) => (s.support = squash(s.support + " " + v)),
          "Support Details": (v) => (s.details = squash(s.details + " " + v)),
          "Support Dates": (v) => { s.start = usDate(v.match(/Start Date:\s*(\S+)/)?.[1]); s.end = usDate(v.match(/End Date:\s*(\S+)/)?.[1]); },
          "Paid Provider": (v) => addProvider(s, v),
          "Natural Support": (v) => (s.naturalSupport = squash(s.naturalSupport + " " + v)),
          "Other Support": (v) => (s.otherSupport = squash(s.otherSupport + " " + v)),
        } : {};
        const set = setters[lab];
        if (set) { set(val); field = { set: lab === "Paid Provider" ? (v) => addProvider(s!, v) : set, col: col === 99 ? 24 : col }; }
        else { issues.push({ level: "info", page: l.page, message: `Unknown label "${lab}" under a goal was ignored.` }); field = null; }
        continue;
      }
      if (field && indent(l.text) >= field.col - 3) { field.set(t); continue; }
      issues.push({ level: "warn", page: l.page, message: `Couldn't place this line: "${t.slice(0, 70)}"` });
    }
    if (mode === "health") flushHealth();

    function addProvider(s: Support, v: string) {
      const pm = v.trim().match(/^([A-Z0-9]{2,4})\s+(.+)$/);
      if (!pm) { if (v.trim()) issues.push({ level: "warn", message: `Paid provider line not understood: "${v.trim()}"` }); return; }
      const ours = isOurs(pm[2]);
      s.providers.push({ code: pm[1], provider: squash(pm[2]), ours });
      if (ours && !s.ourCodes.includes(pm[1])) s.ourCodes.push(pm[1]);
    }
  }

  // 5. Non-goal supports.
  {
    let curS: any = null;
    for (const x of readFields(get("Non Goal Supports"))) {
      if (x.label === "Support") { curS = { support: x.value, details: "", start: null, end: null }; res.nonGoalSupports.push(curS); }
      else if (curS && x.label === "Support Details") curS.details = x.value;
      else if (curS && x.label === "Support Dates") { curS.start = usDate(x.value.match(/Start Date:\s*(\S+)/)?.[1]); curS.end = usDate(x.value.match(/End Date:\s*(\S+)/)?.[1]); }
    }
  }

  // 6. DSPD purchased services ("BC2   Behavior Consultation II", then Type/Amount/Duration).
  {
    let svc: any = null;
    for (const l of get("DSPD Purchased Services")) {
      const t = l.text.trim();
      const head = t.match(/^([A-Z][A-Z0-9]{1,3})\s{2,}([A-Z].+)$/);
      if (head && !/:/.test(t)) { svc = { code: head[1], name: head[2].trim(), unitType: "", units: null, start: null, end: null, page: l.page }; res.purchasedServices.push(svc); continue; }
      const m = t.match(/^(Type|Amount|Duration|Frequency):\s+(.*)$/);
      if (!m) { if (/obsolete/i.test(t)) issues.push({ level: "warn", page: l.page, message: `The PCSP prints "${t}". Confirm which service this applies to.` }); continue; }
      if (!svc || (m[1] === "Type" && svc.unitType)) {
        svc = { code: "", name: "", unitType: "", units: null, start: null, end: null, page: l.page }; res.purchasedServices.push(svc);
        issues.push({ level: "error", page: l.page, message: "A purchased service is listed without its code (the code line is missing in the PDF). Enter the code by hand." });
      }
      if (m[1] === "Type") svc.unitType = m[2].trim();
      if (m[1] === "Amount") svc.units = Number((m[2].match(/(\d+)/) || [])[1] ?? NaN);
      if (m[1] === "Duration") { const d = m[2].match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/); if (d) { svc.start = usDate(d[1]); svc.end = usDate(d[2]); } }
    }
  }

  // 7. Plan budget rows: CODE KIND START END ELIG $RATE MAX UNITS $TOTAL. Provider name wraps above/below.
  {
    const lines = get("Plan Budget");
    lines.forEach((l, i) => {
      const m = l.text.match(/^\s*([A-Z][A-Z0-9]{1,3})\s+([A-Z])\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\S+)\s+\$([\d,.]+)\s+(\d+)\s+(\d+)\s+\$([\d,.]+)/);
      if (!m) {
        if (/obsolete/i.test(l.text)) issues.push({ level: "warn", page: l.page, message: `The budget prints "${l.text.trim()}". Confirm whether a budget line is retired.` });
        return;
      }
      const provider = squash([lines[i - 1]?.text, lines[i + 1]?.text].filter((x) => x && !/\d{2}\/\d{2}\/\d{4}/.test(x) && !/\$/.test(x)).join(" "));
      res.budget.push({ code: m[1], kind: m[2], provider, ours: isOurs(provider), start: usDate(m[3])!, end: usDate(m[4])!,
        rate: Number(m[6].replace(/,/g, "")), maxMonthlyUnits: Number(m[7]), annualUnits: Number(m[8]), total: Number(m[9].replace(/,/g, "")) });
    });
  }

  // 8. Risks.
  {
    let r: any = null;
    for (const x of readFields(get("List of Identified Risks"))) {
      if (x.label === "Identified Risk") { r = { risk: x.value, response: "", responseTime: "", notes: "" }; res.risks.push(r); }
      else if (r && x.label === "Response") r.response = x.value;
      else if (r && x.label === "Response Time") {
        // The Notes label sits in the middle of its text, so overflow under Response Time belongs to Notes.
        const [first, ...rest] = x.value.split(/\s+/);
        r.responseTime = first; r.notesPrefix = rest.join(" ");
      }
      else if (r && x.label === "Notes") { r.notes = squash((r.notesPrefix || "") + " " + x.value); delete r.notesPrefix; }
    }
  }

  // 9. Action plan rows (Label | Note | Category | From), by column position.
  {
    let domain = "";
    let cols: { note: number; cat: number; from: number } | null = null;
    let row: any = null;
    for (const l of get("Action Plan")) {
      const t = l.text.trim();
      if (DOMAINS.includes(t)) { domain = t; row = null; continue; }
      if (/^Label\s+Note\s+Category\s+From$/.test(t)) {
        cols = { note: l.text.indexOf("Note"), cat: l.text.indexOf("Category"), from: l.text.indexOf("From") }; row = null; continue;
      }
      if (!cols) continue;
      const slice = (a: number, b: number) => l.text.slice(Math.max(0, a), b).trim();
      const label = slice(0, cols.note - 1), note = slice(cols.note - 1, cols.cat - 1), cat = slice(cols.cat - 1, cols.from - 1), from = slice(cols.from - 1, 999);
      if (cat && from) { row = { domain, label, note, source: from }; res.aboutMe.push(row); }
      else if (row) { if (label) row.label = squash(row.label + " " + label); if (note) row.note = squash(row.note + " " + note); }
    }
  }

  // 10. Last year's goals, for matching continuing goals.
  {
    let g: any = null;
    const lines = get("Annual Review for Goals");
    for (const x of readFields(lines)) {
      if (x.label === "Goal") { g = { goal: x.value, ongoing: null, status: "", idx: x.idx }; res.lastYearGoals.push(g); }
      else if (g && x.label === "Goal Status") g.status = x.value;
    }
    // "Ongoing Goal for New Plan?   Y" has no colon, so read it directly.
    lines.forEach((l, idx) => {
      const m = l.text.match(/Ongoing Goal for New Plan\?\s+([YN])/);
      if (!m) return;
      const owner = [...res.lastYearGoals].reverse().find((x: any) => x.idx < idx);
      if (owner) owner.ongoing = m[1] === "Y";
    });
    res.lastYearGoals.forEach((x: any) => delete x.idx);
  }

  // 11. Checks.
  if (!res.plan.start || !res.plan.end) issues.push({ level: "error", message: "Plan start or end date not found." });
  if (!res.plan.activatedOn) issues.push({ level: "warn", message: "Plan activation date not found." });
  if (!res.goals.length) issues.push({ level: "error", message: "No goals found." });
  for (const g of res.goals) {
    if (!g.supports.length) issues.push({ level: "warn", page: g.page, message: `Goal "${g.goal.slice(0, 60)}" has no supports.` });
    else if (!g.supports.some((s) => s.ourCodes.length)) issues.push({ level: "info", page: g.page, message: `Goal "${g.goal.slice(0, 60)}" has no supports paid to your agency.` });
    for (const s of g.supports) {
      if (!s.support) issues.push({ level: "warn", page: s.page, message: `A support under "${g.goal.slice(0, 50)}" has no support text.` });
      for (const c of s.ourCodes) if (!opts.agencyCodes.includes(c)) issues.push({ level: "error", page: s.page, message: `Code ${c} is listed for your agency but isn't one of your approved codes.` });
      if (s.start && res.plan.start && s.start < res.plan.start) issues.push({ level: "warn", page: s.page, message: `Support starts ${s.start}, before the plan starts.` });
      if (s.end && res.plan.end && s.end > res.plan.end) issues.push({ level: "warn", page: s.page, message: `Support ends ${s.end}, after the plan ends.` });
    }
  }
  for (const b of res.budget.filter((x) => x.ours)) {
    if (!opts.agencyCodes.includes(b.code)) issues.push({ level: "error", message: `Budget line ${b.code} is for your agency but isn't one of your approved codes.` });
    const ps = res.purchasedServices.find((p) => p.code === b.code);
    if (!ps) issues.push({ level: "warn", message: `Budget line ${b.code} isn't in the purchased services list.` });
    else if (ps.units !== b.annualUnits) issues.push({ level: "error", message: `${b.code}: budget says ${b.annualUnits} units, purchased services says ${ps.units}.` });
  }
  const supportCodes = new Set(res.goals.flatMap((g) => g.supports.flatMap((s) => s.ourCodes)));
  for (const b of res.budget.filter((x) => x.ours)) if (!supportCodes.has(b.code)) issues.push({ level: "warn", message: `${b.code} has a budget but no goal support lists it, so staff on ${b.code} would have nothing to report on.` });
  return res;
}
