// Nectar fallback for a PCSP section the plain-code reader couldn't match
// (text is there, but nothing came out). Off by default (org flag
// `pcsp_nectar_fallback`). Nectar gets only that section's text and a fixed
// JSON schema, and must give {value, page, quote} for every field. A value
// without a quote — or whose quote isn't in the section text — stays blank.
// Pure: the server function makes the call.

import type { PcspSection } from "./parser.ts";
import { ourAgencyMatcher, squash, usDate, type PcspResult } from "./parser-shared.ts";

export const NECTAR_FALLBACK_FLAG = "pcsp_nectar_fallback";

const FIELDS = {
  "Goals and Supports": ["goal", "domain", "support", "details", "paidProvider"],
  "Plan Budget": ["code", "provider", "start", "end", "rate", "maxMonthlyUnits", "annualUnits", "total"],
  "DSPD Purchased Services": ["code", "name", "unitType", "units", "start", "end"],
  "List of Identified Risks": ["risk", "response", "responseTime", "notes"],
} as const;
export type FallbackSection = keyof typeof FIELDS;

const isFallbackSection = (name: string): name is FallbackSection => name in FIELDS;

function isEmptyFor(name: FallbackSection, r: PcspResult): boolean {
  if (name === "Goals and Supports") return r.goals.length === 0;
  if (name === "Plan Budget") return r.budget.length === 0;
  if (name === "DSPD Purchased Services") return r.purchasedServices.length === 0;
  return r.risks.length === 0;
}

/** Sections with real text that the reader got nothing out of. */
export function sectionsNeedingHelp(sections: readonly PcspSection[], r: PcspResult): { name: FallbackSection; text: string }[] {
  const out: { name: FallbackSection; text: string }[] = [];
  for (const s of sections) {
    if (!isFallbackSection(s.name) || !isEmptyFor(s.name, r)) continue;
    const lines = s.lines.filter((l) => l.text.trim());
    if (lines.length < 2 || out.some((o) => o.name === s.name)) continue;
    out.push({ name: s.name, text: lines.map((l) => `[page ${l.page}] ${l.text.trim()}`).join("\n") });
  }
  return out;
}

/** The fixed prompt for one section. */
export function fallbackMessages(name: FallbackSection, text: string): { role: "system" | "user"; content: string }[] {
  const field = '{ "value": string, "page": number | null, "quote": string }';
  const row = `{ ${FIELDS[name].map((f) => `"${f}": ${field}`).join(", ")} }`;
  return [
    {
      role: "system",
      content: [
        `You read the "${name}" section of a Utah DSPD PCSP. Copy values only; never write new text.`,
        `Return JSON exactly like: { "rows": [ ${row} ] }`,
        "For every field: value = the text as printed; page = the [page N] it is on; quote = the exact words from the section that show the value.",
        'If a field is not in the text, give { "value": "", "page": null, "quote": "" }. Never guess.',
        name === "Goals and Supports" ? "One row per support. Repeat the goal on each of its supports. paidProvider = the service code and provider, as printed." : "",
      ].filter(Boolean).join("\n"),
    },
    { role: "user", content: text.slice(0, 30_000) },
  ];
}

type Cell = { value: string; page: number | null };

/** Keep a field only when its quote appears in the section text. */
function cell(raw: unknown, haystack: string): Cell {
  const f = (raw ?? {}) as { value?: unknown; page?: unknown; quote?: unknown };
  const quote = typeof f.quote === "string" ? squash(f.quote) : "";
  const value = typeof f.value === "string" || typeof f.value === "number" ? squash(String(f.value)) : "";
  if (!quote || !value || !haystack.includes(quote.toLowerCase())) return { value: "", page: null };
  return { value, page: typeof f.page === "number" ? f.page : null };
}

const num = (s: string) => {
  const n = Number(s.replace(/[$,\s]/g, "").match(/-?\d+(\.\d+)?/)?.[0] ?? NaN);
  return Number.isFinite(n) ? n : null;
};
const date = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : usDate(s));

/**
 * Fill an empty section of `r` from Nectar's reply. Returns how many rows
 * were used. Adds an issue so a person checks what Nectar read.
 */
export function applyFallback(
  r: PcspResult,
  name: FallbackSection,
  reply: unknown,
  sectionText: string,
  agencyName: string,
): number {
  const hay = squash(sectionText.replace(/\[page \d+\] /g, "")).toLowerCase();
  const rows = Array.isArray((reply as { rows?: unknown })?.rows) ? ((reply as { rows: unknown[] }).rows) : [];
  const read = rows.map((row) => {
    const out: Record<string, Cell> = {};
    for (const f of FIELDS[name]) out[f] = cell((row as Record<string, unknown>)?.[f], hay);
    return out;
  });
  const isOurs = ourAgencyMatcher(agencyName);
  const firstPage = (c: Record<string, Cell>) => Object.values(c).find((x) => x.page !== null)?.page ?? undefined;
  let used = 0;

  if (name === "Plan Budget") {
    for (const c of read) {
      const code = c.code.value.toUpperCase();
      if (!/^[A-Z][A-Z0-9]{1,3}$/.test(code)) continue;
      const start = date(c.start.value), end = date(c.end.value);
      r.budget.push({
        code, kind: "", provider: c.provider.value, ours: isOurs(c.provider.value), start: start ?? "", end: end ?? "",
        rate: num(c.rate.value) ?? 0, maxMonthlyUnits: num(c.maxMonthlyUnits.value) ?? 0,
        annualUnits: num(c.annualUnits.value) ?? 0, total: num(c.total.value) ?? 0,
      });
      used++;
    }
  } else if (name === "DSPD Purchased Services") {
    for (const c of read) {
      if (!c.code.value && !c.name.value) continue;
      r.purchasedServices.push({
        code: c.code.value.toUpperCase(), name: c.name.value, unitType: c.unitType.value, units: num(c.units.value),
        start: date(c.start.value), end: date(c.end.value), page: firstPage(c) ?? 0,
      });
      used++;
    }
  } else if (name === "List of Identified Risks") {
    for (const c of read) {
      if (!c.risk.value) continue;
      r.risks.push({ risk: c.risk.value, response: c.response.value, responseTime: c.responseTime.value, notes: c.notes.value });
      used++;
    }
  } else {
    for (const c of read) {
      if (!c.goal.value) continue;
      let goal = r.goals.find((g) => g.goal === c.goal.value);
      if (!goal) {
        goal = { goal: c.goal.value, domain: c.domain.value, currentStatus: "", strengths: "", barriers: "", successPerson: "", successTeam: "", supports: [], page: c.goal.page ?? 0 };
        r.goals.push(goal);
      }
      if (c.support.value) {
        const pm = c.paidProvider.value.match(/^([A-Z0-9]{2,4})\s+(.+)$/);
        const provider = pm ? { code: pm[1], provider: pm[2], ours: isOurs(pm[2]) } : null;
        goal.supports.push({
          support: c.support.value, details: c.details.value, start: null, end: null,
          providers: provider ? [provider] : [], ourCodes: provider?.ours ? [provider.code] : [],
          naturalSupport: "", otherSupport: "", healthNeeds: [], page: c.support.page ?? goal.page,
        });
      }
      used++;
    }
  }
  r.issues.push({
    level: "warn",
    page: read.map(firstPage).find((p) => p !== undefined),
    message: used
      ? `The "${name}" section didn't match the usual layout, so Nectar read it (${used} row${used === 1 ? "" : "s"}). Check each value against the PDF.`
      : `The "${name}" section didn't match the usual layout and couldn't be read. Enter it by hand.`,
  });
  return used;
}
