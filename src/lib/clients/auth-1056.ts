// "Fill from 1056": the pure half. Nectar reads the 1056's text and must give
// {value, page, quote} for every field; a value whose quote isn't in the
// document text is dropped (left blank for a person to fill). The review
// then checks codes against the agency's approved codes, real dates and
// whole-number units before anything is saved. Nectar never invents values.

import {
  authorizationProblems,
  authorizationValues,
  isYmd,
  normalizeCode,
  type AuthorizationInput,
} from "./authorizations.ts";
import { isDailyServiceCode } from "../service-billing.ts";

export type Sourced<T> = { value: T | null; page: number | null; quote: string };

export type Read1056Line = {
  code: Sourced<string>;
  rate: Sourced<number>;
  annualUnits: Sourced<number>;
  start: Sourced<string>;
  end: Sourced<string>;
};

export type Read1056 = {
  authorizationNumber: Sourced<string>;
  approvedOn: Sourced<string>;
  lines: Read1056Line[];
};

const LINE_FIELDS = ["code", "rate", "annualUnits", "start", "end"] as const;

/** The fixed prompt. `text` is the 1056 text with [page N] markers. */
export function read1056Messages(text: string): { role: "system" | "user"; content: string }[] {
  const field = '{ "value": string, "page": number | null, "quote": string }';
  const line = `{ ${LINE_FIELDS.map((f) => `"${f}": ${field}`).join(", ")} }`;
  return [
    {
      role: "system",
      content: [
        "You read a Utah DSPD 1056 (service authorization / budget). Copy values only; never write new text.",
        `Return JSON exactly like: { "authorizationNumber": ${field}, "approvedOn": ${field}, "lines": [ ${line} ] }`,
        "One line per service code. code = the short service code (for example DSI). rate = dollars per unit. annualUnits = units authorized for the year. start / end = the authorization dates.",
        "For every field: value = the text as printed; page = the [page N] it is on; quote = the exact words from the document that show the value.",
        'If a field is not in the text, give { "value": "", "page": null, "quote": "" }. Never guess.',
      ].join("\n"),
    },
    { role: "user", content: text.slice(0, 40_000) },
  ];
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** Raw string cell, kept only when its quote is in the document text. */
function cell(raw: unknown, haystack: string): Sourced<string> {
  const f = (raw ?? {}) as { value?: unknown; page?: unknown; quote?: unknown };
  const quote = typeof f.quote === "string" ? squash(f.quote) : "";
  const value = typeof f.value === "string" || typeof f.value === "number" ? squash(String(f.value)) : "";
  if (!quote || !value || !haystack.includes(quote.toLowerCase())) return { value: null, page: null, quote: "" };
  return { value, page: typeof f.page === "number" ? f.page : null, quote };
}

/** "$1,234.50" → 1234.5; anything else → null. */
export function parseAmount(s: string | null): number | null {
  if (!s) return null;
  const m = s.replace(/[$,\s]/g, "").match(/^-?\d+(\.\d+)?$/);
  return m ? Number(m[0]) : null;
}

/** "07/01/2026", "7/1/2026" or "2026-07-01" → "2026-07-01"; anything else → null. */
export function parseFormDate(s: string | null): string | null {
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const out = iso ? s : us ? `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}` : null;
  return isYmd(out) ? out : null;
}

function mapCell<T>(c: Sourced<string>, parse: (s: string | null) => T | null): Sourced<T> {
  const value = parse(c.value);
  return value == null ? { value: null, page: c.page, quote: c.quote } : { value, page: c.page, quote: c.quote };
}

/** Nectar's reply → checked fields. Unquoted or unreadable values come back null. */
export function read1056FromReply(reply: unknown, text: string): Read1056 {
  const hay = squash(text).toLowerCase();
  const r = (reply ?? {}) as { authorizationNumber?: unknown; approvedOn?: unknown; lines?: unknown };
  const lines = Array.isArray(r.lines) ? r.lines.slice(0, 40) : [];
  return {
    authorizationNumber: cell(r.authorizationNumber, hay),
    approvedOn: mapCell(cell(r.approvedOn, hay), parseFormDate),
    lines: lines
      .map((raw) => {
        const l = (raw ?? {}) as Record<string, unknown>;
        return {
          code: mapCell(cell(l.code, hay), (s) => (s ? normalizeCode(s) : null)),
          rate: mapCell(cell(l.rate, hay), parseAmount),
          annualUnits: mapCell(cell(l.annualUnits, hay), parseAmount),
          start: mapCell(cell(l.start, hay), parseFormDate),
          end: mapCell(cell(l.end, hay), parseFormDate),
        };
      })
      .filter((l) => l.code.value),
  };
}

// ─── Review ─────────────────────────────────────────────────────────────────

export type Review1056Line = {
  include: boolean;
  code: string;
  unitType: string;
  rate: number | null;
  annualUnits: number | null;
  start: string | null;
  end: string | null;
  /** Where each value came from, for the "Page N: '…'" hints. */
  sources: Partial<Record<(typeof LINE_FIELDS)[number], { page: number | null; quote: string }>>;
};

export type Review1056 = {
  authorizationNumber: string;
  approvedOn: string | null;
  lines: Review1056Line[];
};

function source(c: Sourced<unknown>) {
  return c.quote ? { page: c.page, quote: c.quote } : undefined;
}

/** The editable review. Lines for codes the agency isn't approved for start unticked. */
export function initial1056Review(read: Read1056, agencyCodes: readonly string[]): Review1056 {
  const approved = new Set(agencyCodes.map(normalizeCode));
  return {
    authorizationNumber: read.authorizationNumber.value ?? "",
    approvedOn: read.approvedOn.value,
    lines: read.lines.map((l) => {
      const code = l.code.value ?? "";
      return {
        include: approved.size === 0 || approved.has(code),
        code,
        unitType: isDailyServiceCode(code) ? "day" : "Q",
        rate: l.rate.value,
        annualUnits: l.annualUnits.value,
        start: l.start.value,
        end: l.end.value,
        sources: {
          code: source(l.code),
          rate: source(l.rate),
          annualUnits: source(l.annualUnits),
          start: source(l.start),
          end: source(l.end),
        },
      };
    }),
  };
}

function lineInput(review: Review1056, l: Review1056Line): AuthorizationInput {
  return {
    code: l.code,
    unitType: l.unitType,
    rate: l.rate,
    annualUnits: l.annualUnits,
    start: l.start,
    end: l.end,
    authorizationNumber: review.authorizationNumber,
    approvedOn: review.approvedOn,
  };
}

/** Problems that stop Confirm. */
export function review1056Problems(review: Review1056, agencyCodes: readonly string[]): string[] {
  const kept = review.lines.filter((l) => l.include);
  if (kept.length === 0) return ["Keep at least one line, or cancel."];
  const out: string[] = [];
  if (review.approvedOn && !isYmd(review.approvedOn)) out.push("The 1056 approved date isn't a real date.");
  const seen = new Set<string>();
  for (const l of kept) {
    out.push(...authorizationProblems(lineInput(review, l), agencyCodes));
    const code = normalizeCode(l.code);
    if (seen.has(code)) out.push(`${code} is listed twice — keep one line per code.`);
    seen.add(code);
  }
  return out;
}

/** Things for a person to look at: fields Nectar couldn't show in the document. */
export function read1056Checks(read: Read1056): string[] {
  const out: string[] = [];
  if (!read.authorizationNumber.value) out.push("The 1056 number wasn't found — type it in.");
  if (!read.approvedOn.value) out.push("The approved date wasn't found — type it in.");
  if (read.lines.length === 0) out.push("No service lines were found. Enter the authorizations by hand.");
  for (const l of read.lines) {
    const missing = LINE_FIELDS.filter((f) => l[f].value == null);
    if (missing.length) out.push(`${l.code.value}: couldn't read ${missing.join(", ")} — check the form.`);
  }
  return out;
}

/** client_billing_codes upsert rows for the kept lines. */
export function rowsFrom1056(
  review: Review1056,
  ctx: { organizationId: string; clientId: string; documentId: string; now: string },
): Record<string, unknown>[] {
  return review.lines
    .filter((l) => l.include)
    .map((l) => ({
      ...authorizationValues(lineInput(review, l)),
      organization_id: ctx.organizationId,
      client_id: ctx.clientId,
      rate_source: review.authorizationNumber ? `from 1056 ${review.authorizationNumber}` : "from 1056",
      rate_source_plan_number: review.authorizationNumber || null,
      rate_source_document_id: ctx.documentId,
      rate_source_at: ctx.now,
    }));
}
