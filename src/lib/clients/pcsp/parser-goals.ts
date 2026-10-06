// "Goals and Supports" section of a USTEPS PCSP: goals → supports → paid
// providers, success criteria, and the two-column "Addressed Health and
// Safety Needs" table. A goal title repeated at the top of a continued page
// is stitched back onto the same goal.

import {
  indent, LABEL, squash, supportDates,
  type Goal, type Issue, type L, type Support,
} from "./parser-shared.ts";

type Mode = "goal" | "success" | "support" | "health";

export function readGoals(lines: L[], isOurs: (provider: string) => boolean, issues: Issue[]): Goal[] {
  const goals: Goal[] = [];
  let goal: Goal | null = null;
  let sup: Support | null = null;
  let mode: Mode = "goal";
  let field: { set: (v: string) => void; col: number } | null = null;
  let health: { left: L[]; right: L[] } = { left: [], right: [] };
  let successQ = 0;

  function addProvider(s: Support, v: string) {
    const pm = v.trim().match(/^([A-Z0-9]{2,4})\s+(.+)$/);
    if (!pm) {
      if (v.trim()) issues.push({ level: "warn", message: `Paid provider line not understood: "${v.trim()}"` });
      return;
    }
    const ours = isOurs(pm[2]);
    s.providers.push({ code: pm[1], provider: squash(pm[2]), ours });
    if (ours && !s.ourCodes.includes(pm[1])) s.ourCodes.push(pm[1]);
  }

  const flushHealth = () => {
    if (sup && (health.left.length || health.right.length)) addHealthNeeds(sup, health, issues);
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
      if (goal && squash(val) === squash(goal.goal)) {
        mode = sup ? (mode === "health" ? "support" : mode) : "goal";
        field = null;
        continue;
      }
      goal = { goal: val, domain: "", currentStatus: "", strengths: "", barriers: "", successPerson: "", successTeam: "", supports: [], page: l.page };
      goals.push(goal);
      sup = null; mode = "goal"; field = null;
      continue;
    }
    if (!goal) { issues.push({ level: "warn", page: l.page, message: `Text before the first goal was ignored: "${t.slice(0, 60)}"` }); continue; }
    if (t === "Success Criteria") { mode = "success"; field = null; successQ = 0; continue; }
    if (t === "Support Item") {
      if (mode === "health") flushHealth();
      sup = { support: "", details: "", start: null, end: null, providers: [], ourCodes: [], naturalSupport: "", otherSupport: "", healthNeeds: [], page: l.page };
      goal.supports.push(sup); mode = "support"; field = null;
      continue;
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
        "Support Dates": (v) => { const d = supportDates(v); s.start = d.start; s.end = d.end; },
        "Paid Provider": (v) => addProvider(s, v),
        "Natural Support": (v) => (s.naturalSupport = squash(s.naturalSupport + " " + v)),
        "Other Support": (v) => (s.otherSupport = squash(s.otherSupport + " " + v)),
      } : {};
      const set = setters[lab];
      if (set) { set(val); field = { set, col: col === 99 ? 24 : col }; }
      else { issues.push({ level: "info", page: l.page, message: `Unknown label "${lab}" under a goal was ignored.` }); field = null; }
      continue;
    }
    if (field && indent(l.text) >= field.col - 3) { field.set(t); continue; }
    issues.push({ level: "warn", page: l.page, message: `Couldn't place this line: "${t.slice(0, 70)}"` });
  }
  if (mode === "health") flushHealth();
  return goals;
}

/** Pair the health-need categories (left column) with their descriptions (right column). */
function addHealthNeeds(sup: Support, health: { left: L[]; right: L[] }, issues: Issue[]) {
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
    if (!category) issues.push({ level: "warn", page: b.lines[0]?.page, message: `A health and safety need under "${sup.support.slice(0, 50)}" has a description but no category.` });
    sup.healthNeeds.push({ category: category || "(unlabeled)", description: squash(b.lines.map((x) => x.text).join(" ")) });
  });
}
