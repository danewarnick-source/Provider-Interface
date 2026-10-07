// What a PCSP read and save tell the person, in plain words, and the no-PHI
// row each read writes to pcsp_read_log. Pure; shared by Add client and
// Upload PCSP in Plans.

import { formatDate } from "../dates.ts";
import type { PcspResult } from "./parser-shared.ts";

/** Where Upload PCSP in Plans puts the PDF before it is read. */
export const pcspFolder = (organizationId: string, clientId: string) => `${organizationId}/${clientId}/pcsp/`;

/** Where Add client puts a PCSP before the client exists. */
export const newClientPcspFolder = (organizationId: string) => `${organizationId}/new-clients/`;

/** An uploaded path the server may read: inside `folder`, no "..". */
export function inFolder(storagePath: string, folder: string): boolean {
  return storagePath.startsWith(folder) && storagePath.length > folder.length && !storagePath.includes("..");
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function codesPart(codes: readonly { code: string; units: number }[]): string | null {
  if (!codes.length) return null;
  const list = codes.map((c) => c.code).join(", ");
  const withUnits = codes.every((c) => c.units > 0);
  return `${plural(codes.length, "code")}${withUnits ? " with units" : ""} (${list})`;
}

export interface ReadReport {
  /** "Filled from the PCSP: name, PID, …" */
  line: string;
  /** Why no codes were filled, with what to check; null when codes were found. */
  noCodes: string | null;
}

/** The result shown after a read, e.g. "Filled from the PCSP: name, PID, support coordinator, plan year …". */
export function readReport(parse: PcspResult, agencyName: string): ReadReport {
  const p = parse.person;
  const parts: string[] = [];
  if (p.name.trim()) parts.push("name");
  if (p.pid.trim()) parts.push("PID");
  if (p.dob) parts.push("date of birth");
  if (p.phone.trim()) parts.push("phone");
  if (p.residentialAddress.trim()) parts.push("address");
  if (p.supportCoordinator.name.trim()) parts.push("support coordinator");
  if (parse.plan.start && parse.plan.end)
    parts.push(`plan year ${formatDate(parse.plan.start)} – ${formatDate(parse.plan.end)}`);
  if (parse.goals.length) parts.push(plural(parse.goals.length, "goal"));
  const ours = parse.budget.filter((b) => b.ours);
  const codes = codesPart(
    [...new Set(ours.map((b) => b.code))].map((code) => ({
      code,
      units: ours.filter((b) => b.code === code).reduce((n, b) => n + (b.annualUnits || 0), 0),
    })),
  );
  if (codes) parts.push(codes);
  const name = agencyName.trim() || "your agency";
  return {
    line: parts.length
      ? `Filled from the PCSP: ${parts.join(", ")}.`
      : "Nothing could be read from this PCSP. Enter the details by hand.",
    noCodes: ours.length
      ? null
      : `No purchased services for ${name} were found. Check the agency's legal name in Settings matches the PCSP.`,
  };
}

/** What was saved, e.g. "Saved from the PCSP: plan year …, 4 goals, 9 supports, 3 codes (SLH, DSI, HHS), 1 contact." */
export function savedReport(
  saved: { goals: number; supports: number; codes: string[]; contacts: number; profile: string[] },
  plan: { start: string | null; end: string | null },
): string {
  const parts: string[] = [];
  if (saved.profile.length) parts.push(saved.profile.join(", "));
  if (plan.start && plan.end) parts.push(`plan year ${formatDate(plan.start)} – ${formatDate(plan.end)}`);
  parts.push(plural(saved.goals, "goal"), plural(saved.supports, "support"));
  if (saved.codes.length) parts.push(`${plural(saved.codes.length, "code")} (${saved.codes.join(", ")})`);
  if (saved.contacts) parts.push(plural(saved.contacts, "new contact"));
  return `Saved from the PCSP: ${parts.join(", ")}.`;
}

/** How filing the PCSP in the Client file went. */
export type FiledOutcome = "filed" | "no_file_row" | { error: string };

export function filedReport(filed: FiledOutcome): string {
  if (filed === "filed") return "Filed in the Client file as the current PCSP.";
  if (filed === "no_file_row") return "The PCSP is saved with the plan year in Plans.";
  return `The PCSP is saved with the plan year, but it couldn't be marked as the current PCSP in the Client file: ${filed.error}`;
}

export type ReadErrorKind = "timeout" | "too_big" | "not_pdf" | "no_text" | "network" | "storage" | "server";

const KINDS: [ReadErrorKind, RegExp][] = [
  ["timeout", /timed? ?out|took too long|\b504\b|FUNCTION_INVOCATION_TIMEOUT|aborted/i],
  ["too_big", /\b413\b|too large|payload|body exceeded|over 15 MB/i],
  ["not_pdf", /as a PDF/i],
  ["no_text", /No text was found/i],
  ["storage", /upload|storage|bucket|object not found/i],
  ["network", /Failed to fetch|NetworkError|network|Load failed/i],
];

/** Sort a read error into a kind (logged, never the message itself). */
export function readErrorKind(message: string): ReadErrorKind {
  return KINDS.find(([, re]) => re.test(message))?.[0] ?? "server";
}

const REASON: Record<Exclude<ReadErrorKind, "not_pdf" | "no_text" | "server">, string> = {
  timeout: "the server took too long",
  too_big: "the file is too big. Upload a copy under 15 MB",
  network: "the connection dropped",
  storage: "the file couldn't be uploaded",
};

/** "Couldn't read the PCSP: the server took too long." — shown beside "Try again". */
export function readFailure(message: string): string {
  const kind = readErrorKind(message);
  const clean = message.trim().replace(/\.$/, "");
  const reason =
    kind in REASON
      ? REASON[kind as keyof typeof REASON]
      : /^(Internal Server Error|HTTP ERROR|\d{3}\b)/i.test(clean) || !clean
        ? "the server hit an error"
        : clean.charAt(0).toLowerCase() + clean.slice(1);
  return `Couldn't read the PCSP: ${reason}.`;
}

export interface ReadLogInput {
  organizationId: string;
  userId: string;
  source: "new_client" | "plans";
  pageCount: number | null;
  parse: PcspResult | null;
  nectarSections: readonly string[];
  durationMs: number;
  error: string | null;
}

/** The pcsp_read_log row: counts, codes and timings only — no names, PIDs or PCSP text. */
export function readLogRow(i: ReadLogInput) {
  return {
    organization_id: i.organizationId,
    read_by: i.userId,
    source: i.source,
    page_count: i.pageCount,
    goals_found: i.parse ? i.parse.goals.length : null,
    codes_found: i.parse ? [...new Set(i.parse.budget.filter((b) => b.ours).map((b) => b.code))] : [],
    nectar_sections: [...i.nectarSections],
    duration_ms: Math.max(0, Math.round(i.durationMs)),
    error_kind: i.error === null ? null : readErrorKind(i.error),
  };
}
