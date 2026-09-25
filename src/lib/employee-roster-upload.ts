/**
 * Add several employees at once.
 * Basics only: name, email, phone, hire date, job title.
 * Never maps guardian / meds / PCSP / billing / client fields.
 * Existing roster emails are skipped. There is no update mode.
 */
import Papa from "papaparse";
import { isValidSignupEmail, normalizeSignupEmail } from "./signup-email.ts";

export const EMPLOYEE_ROSTER_HEADERS = [
  "name",
  "email",
  "phone",
  "hire_date",
  "job_title",
] as const;

export type EmployeeRosterHeader = (typeof EMPLOYEE_ROSTER_HEADERS)[number];

export type EmployeeRosterRole =
  | "admin"
  | "program_manager"
  | "manager"
  | "employee"
  | "committee_member";

/** createInvitation / resendInvitation only accept these three. */
export type EmployeeInviteRole = "admin" | "manager" | "employee";

export type EmployeeRosterDraft = {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  hire_date: string;
  job_title: string;
};

export type EmployeeRosterRowAction = "create" | "skip";

export type EmployeeRosterIssueField = EmployeeRosterHeader | "row";

export type EmployeeRosterIssue = { field: EmployeeRosterIssueField; message: string };

type MappedKey = EmployeeRosterHeader | "first_name" | "last_name";

const HEADER_ALIASES: Record<string, MappedKey> = {
  name: "name",
  full_name: "name",
  employee_name: "name",
  staff_name: "name",
  first_name: "first_name",
  firstname: "first_name",
  first: "first_name",
  last_name: "last_name",
  lastname: "last_name",
  last: "last_name",
  email: "email",
  email_address: "email",
  e_mail: "email",
  phone: "phone",
  phone_number: "phone",
  mobile: "phone",
  hire_date: "hire_date",
  start_date: "hire_date",
  job_title: "job_title",
  jobtitle: "job_title",
  title: "job_title",
  position: "job_title",
};

const CLIENT_ONLY_HEADERS = [
  "guardian",
  "medicaid",
  "pcsp",
  "medication",
  "meds",
  "billing",
  "billing_code",
  "service_code",
  "client",
  "client_record",
];

const ROLE_ALIASES: Record<string, EmployeeRosterRole> = {
  employee: "employee",
  staff: "employee",
  dsp: "employee",
  manager: "manager",
  supervisor: "manager",
  admin: "admin",
  owner: "admin",
  program_manager: "program_manager",
  committee_member: "committee_member",
  committee: "committee_member",
};

const EXAMPLE_ROW: Record<EmployeeRosterHeader, string> = {
  name: "Jane Doe",
  email: "jane.doe@example.com",
  phone: "555-123-4567",
  hire_date: "2026-07-01",
  job_title: "Direct Support",
};

function slugHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function mapRosterColumn(raw: string): MappedKey | null {
  return HEADER_ALIASES[slugHeader(raw)] ?? null;
}

export function normalizeEmployeeRosterHeader(raw: string): EmployeeRosterHeader | null {
  const key = mapRosterColumn(raw);
  if (key === "first_name" || key === "last_name") return null;
  return key;
}

export function isClientOnlyRosterHeader(raw: string): boolean {
  const slug = slugHeader(raw);
  return CLIENT_ONLY_HEADERS.some((h) => slug === h || slug.startsWith(`${h}_`));
}

export function parseEmployeeRosterRole(raw: string): EmployeeRosterRole | null {
  const key = slugHeader(raw);
  if (!key) return "employee";
  return ROLE_ALIASES[key] ?? null;
}

export function toInviteRole(raw: string): EmployeeInviteRole {
  const parsed = parseEmployeeRosterRole(raw);
  if (parsed === "admin") return "admin";
  if (parsed === "manager" || parsed === "program_manager") return "manager";
  return "employee";
}

export function splitPersonName(raw: string): { first_name: string; last_name: string } {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return { first_name: "", last_name: "" };
  const idx = t.lastIndexOf(" ");
  if (idx <= 0) return { first_name: t, last_name: "" };
  return { first_name: t.slice(0, idx), last_name: t.slice(idx + 1) };
}

export function normalizeRosterEmailSet(emails: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const raw of emails) {
    const email = normalizeSignupEmail(raw);
    if (email) out.add(email);
  }
  return out;
}

/** Existing roster emails are skipped. There is no update mode. */
export function classifyRosterRowAction(
  email: string,
  existingEmails: Iterable<string>,
): EmployeeRosterRowAction {
  const exists = normalizeRosterEmailSet(existingEmails).has(normalizeSignupEmail(email));
  return exists ? "skip" : "create";
}

export function normalizeHireDate(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)) {
    const [m, d, y] = t.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    if (n > 20000 && n < 80000) {
      const utc = Date.UTC(1899, 11, 30) + Math.round(n) * 86_400_000;
      return new Date(utc).toISOString().slice(0, 10);
    }
  }
  return t;
}

function newRowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyEmployeeRosterDraft(): EmployeeRosterDraft {
  return {
    id: newRowId(),
    name: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    hire_date: "",
    job_title: "",
  };
}

function draftFromParts(parts: {
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  hire_date?: string;
  job_title?: string;
}): EmployeeRosterDraft {
  const explicitFirst = (parts.first_name ?? "").trim();
  const explicitLast = (parts.last_name ?? "").trim();
  const combined = [explicitFirst, explicitLast].filter(Boolean).join(" ");
  const name = (parts.name ?? "").trim() || combined;
  const split =
    explicitFirst || explicitLast
      ? { first_name: explicitFirst, last_name: explicitLast }
      : splitPersonName(name);
  const email = normalizeSignupEmail(parts.email ?? "");
  return {
    id: newRowId(),
    name: name || [split.first_name, split.last_name].filter(Boolean).join(" "),
    first_name: split.first_name,
    last_name: split.last_name,
    email,
    phone: (parts.phone ?? "").trim(),
    hire_date: normalizeHireDate(parts.hire_date ?? ""),
    job_title: (parts.job_title ?? "").trim(),
  };
}

export function buildEmployeeRosterTemplateCsv(): string {
  return Papa.unparse({
    fields: [...EMPLOYEE_ROSTER_HEADERS],
    data: [EXAMPLE_ROW],
  });
}

export function triggerEmployeeRosterTemplateDownload(): void {
  const blob = new Blob([buildEmployeeRosterTemplateCsv()], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "employee-roster-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function mapRawRosterRow(
  raw: Record<string, string>,
  headers: string[],
): EmployeeRosterDraft {
  const mapped: Partial<Record<MappedKey, string>> = {};
  for (const header of headers) {
    if (isClientOnlyRosterHeader(header)) continue;
    const key = mapRosterColumn(header);
    if (!key) continue;
    const value = String(raw[header] ?? "").trim();
    if (!value) continue;
    mapped[key] = mapped[key] ? `${mapped[key]} ${value}`.trim() : value;
  }
  return draftFromParts(mapped);
}

function ignoredHeaders(headers: string[]): string[] {
  return headers.filter((h) => {
    if (!h.trim()) return false;
    if (isClientOnlyRosterHeader(h)) return true;
    return !mapRosterColumn(h);
  });
}

export function parseEmployeeRosterCsv(text: string): {
  rows: EmployeeRosterDraft[];
  ignoredColumns: string[];
} {
  const res = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const headers = res.meta.fields ?? [];
  const rows = (res.data ?? [])
    .map((raw) => mapRawRosterRow(raw, headers))
    .filter((row) => row.name || row.first_name || row.last_name || row.email);
  return { rows, ignoredColumns: ignoredHeaders(headers) };
}

export function parseEmployeeRosterRecords(
  records: Record<string, string>[],
  headers: string[],
): { rows: EmployeeRosterDraft[]; ignoredColumns: string[] } {
  const rows = records
    .map((raw) => mapRawRosterRow(raw, headers))
    .filter((row) => row.name || row.first_name || row.last_name || row.email);
  return { rows, ignoredColumns: ignoredHeaders(headers) };
}

function splitPasteLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  const parsed = Papa.parse<string[]>(line, { header: false, skipEmptyLines: true });
  const row = parsed.data?.[0];
  if (Array.isArray(row)) return row.map((c) => String(c ?? "").trim());
  return [line.trim()];
}

function lineLooksLikeHeader(line: string): boolean {
  return splitPasteLine(line).some((cell) => mapRosterColumn(cell) === "email");
}

/** Header row if it contains Email; otherwise name, email, phone, hire date, job title. */
export function parseEmployeeRosterPaste(text: string): {
  rows: EmployeeRosterDraft[];
  ignoredColumns: string[];
} {
  const trimmed = text.trim();
  if (!trimmed) return { rows: [], ignoredColumns: [] };
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim());
  const first = lines[0] ?? "";
  if (lineLooksLikeHeader(first)) return parseEmployeeRosterCsv(trimmed);
  const rows = lines
    .map((line) => {
      const [name, email, phone, hireDate, jobTitle] = splitPasteLine(line);
      return draftFromParts({
        name,
        email,
        phone,
        hire_date: hireDate,
        job_title: jobTitle,
      });
    })
    .filter((row) => row.name || row.email || row.phone || row.hire_date || row.job_title);
  return { rows, ignoredColumns: [] };
}

function duplicateEmails(rows: EmployeeRosterDraft[]): Set<string> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const email = normalizeSignupEmail(row.email);
    if (!email || !isValidSignupEmail(email)) continue;
    counts.set(email, (counts.get(email) ?? 0) + 1);
  }
  const dups = new Set<string>();
  for (const [email, count] of counts) {
    if (count > 1) dups.add(email);
  }
  return dups;
}

export function validateEmployeeRosterRows(
  rows: EmployeeRosterDraft[],
): Map<string, EmployeeRosterIssue[]> {
  const issues = new Map<string, EmployeeRosterIssue[]>();
  const dups = duplicateEmails(rows);
  for (const row of rows) {
    const list: EmployeeRosterIssue[] = [];
    if (!row.first_name.trim() && !row.last_name.trim()) {
      list.push({ field: "name", message: "Name is required." });
    } else if (!row.first_name.trim() || !row.last_name.trim()) {
      list.push({ field: "name", message: "Enter a first and last name." });
    }
    if (!row.email.trim()) list.push({ field: "email", message: "Email is required." });
    else if (!isValidSignupEmail(row.email))
      list.push({ field: "email", message: "Enter a valid email." });
    if (!row.phone.trim()) list.push({ field: "phone", message: "Phone is required." });
    if (!row.hire_date.trim()) list.push({ field: "hire_date", message: "Hire date is required." });
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.hire_date)) {
      list.push({ field: "hire_date", message: "Use YYYY-MM-DD." });
    }
    if (dups.has(normalizeSignupEmail(row.email))) {
      list.push({ field: "email", message: "This email is listed more than once." });
    }
    if (list.length) issues.set(row.id, list);
  }
  return issues;
}

export function rosterRowHasFieldIssue(
  issues: Map<string, EmployeeRosterIssue[]>,
  rowId: string,
  field: EmployeeRosterIssueField,
): boolean {
  return (issues.get(rowId) ?? []).some((i) => i.field === field);
}

export function applyRosterName(row: EmployeeRosterDraft, name: string): EmployeeRosterDraft {
  const split = splitPersonName(name);
  return {
    ...row,
    name,
    first_name: split.first_name,
    last_name: split.last_name,
  };
}
