/**
 * Import team members from a paste, CSV or Excel file.
 *
 * Columns: name OR first/last name, email, phone, hire date, preset (the agency's
 * access preset name), home (team name), job title, position, date of birth,
 * transports (yes/no). Paste and file go through the same grid parser and the
 * same header detector (exact cell match). Templates are built from the agency's
 * own presets and homes. Existing people are never updated from here.
 */
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { isValidSignupEmail, normalizeSignupEmail } from "../signup-email.ts";
import {
  IMPORT_MAX_ROWS,
  OWNER_ACCESS,
  defaultStaffPresetId,
  type AccessChoice,
  type PresetPick,
} from "./add-member.ts";

export const TEAM_IMPORT_HEADERS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "hire_date",
  "preset",
  "home",
  "job_title",
  "position",
  "date_of_birth",
  "transports",
] as const;

export type TeamImportColumn = (typeof TEAM_IMPORT_HEADERS)[number] | "name";

/** Column order for a paste with no header row. */
export const TEAM_IMPORT_PASTE_ORDER: readonly TeamImportColumn[] = [
  "name",
  "email",
  "phone",
  "hire_date",
  "preset",
  "home",
  "job_title",
  "position",
  "date_of_birth",
  "transports",
];

export type ImportAgency = {
  presets: ReadonlyArray<PresetPick & { seed_key?: string | null }>;
  homes: ReadonlyArray<{ id: string; name: string }>;
  positions: ReadonlyArray<{ key: string; label: string }>;
  /** Owner / Admin presets are only assignable by an Owner. */
  viewerIsOwner: boolean;
};

export type TeamImportDraft = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  /** YYYY-MM-DD when parseable, else the raw text (flagged). */
  hire_date: string;
  date_of_birth: string;
  job_title: string;
  /** Preset as typed; `access` is the resolved choice ("" when unknown). */
  preset: string;
  access: AccessChoice | "";
  /** Home as typed; `homeId` is the resolved team id ("" = none / unknown). */
  home: string;
  homeId: string;
  /** Position as typed; `positions` are the resolved staff_types keys. */
  position: string;
  positions: string[];
  transports: boolean;
  /** Transports cell as typed, kept to flag values that aren't yes/no. */
  transportsRaw: string;
};

export type TeamImportIssueField =
  | "name"
  | "email"
  | "hire_date"
  | "date_of_birth"
  | "preset"
  | "home"
  | "position"
  | "transports";

export type TeamImportIssue = { field: TeamImportIssueField; message: string };

const HEADER_ALIASES: Record<string, TeamImportColumn> = {
  name: "name",
  full_name: "name",
  team_member: "name",
  team_member_name: "name",
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
  cell: "phone",
  hire_date: "hire_date",
  start_date: "hire_date",
  date_hired: "hire_date",
  preset: "preset",
  access: "preset",
  access_preset: "preset",
  access_level: "preset",
  home: "home",
  team: "home",
  house: "home",
  job_title: "job_title",
  jobtitle: "job_title",
  title: "job_title",
  position: "position",
  positions: "position",
  date_of_birth: "date_of_birth",
  dob: "date_of_birth",
  birth_date: "date_of_birth",
  birthdate: "date_of_birth",
  transports: "transports",
  transports_clients: "transports",
  transport: "transports",
  drives_clients: "transports",
};

export function slugCell(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Exact header cell → column, or null. */
export function columnForHeader(raw: unknown): TeamImportColumn | null {
  return HEADER_ALIASES[slugCell(raw)] ?? null;
}

/**
 * One header detector for paste and file: a row is the header when a cell is
 * exactly an Email header, or at least two cells are exactly known headers.
 * "Jane Email-Smith" or an address containing "email" is not a header.
 */
export function isHeaderRow(cells: readonly unknown[]): boolean {
  const cols = cells.map(columnForHeader).filter((c): c is TeamImportColumn => !!c);
  return cols.includes("email") || new Set(cols).size >= 2;
}

/**
 * Dates: YYYY-MM-DD, M/D/YYYY, M/D/YY (→ 20YY), and Excel serial numbers.
 * Anything else comes back trimmed so validation can flag it.
 */
export function normalizeImportDate(raw: unknown): string {
  if (typeof raw === "number") return excelSerialToYmd(raw) ?? String(raw);
  const t = String(raw ?? "").trim();
  if (!t) return "";
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return validYmd(+m[1], +m[2], +m[3]) ?? t;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/.exec(t);
  if (m) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return validYmd(year, +m[1], +m[2]) ?? t;
  }
  if (/^\d+(\.\d+)?$/.test(t)) return excelSerialToYmd(Number(t)) ?? t;
  return t;
}

function validYmd(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return dt.toISOString().slice(0, 10);
}

/** Excel's day 1 is 1900-01-01 (with the 1900 leap-year bug, hence the 1899-12-30 epoch). */
function excelSerialToYmd(n: number): string | null {
  if (!Number.isFinite(n) || n < 1000 || n > 2958465) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.floor(n) * 86_400_000;
  return new Date(utc).toISOString().slice(0, 10);
}

export function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** yes/no → boolean; blank → false; anything else → null (flagged). */
export function parseYesNo(raw: unknown): boolean | null {
  const t = slugCell(raw);
  if (!t) return false;
  if (["yes", "y", "true", "1", "x"].includes(t)) return true;
  if (["no", "n", "false", "0"].includes(t)) return false;
  return null;
}

export function splitPersonName(raw: string): { first_name: string; last_name: string } {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return { first_name: "", last_name: "" };
  const idx = t.lastIndexOf(" ");
  if (idx <= 0) return { first_name: t, last_name: "" };
  return { first_name: t.slice(0, idx), last_name: t.slice(idx + 1) };
}

/** Preset cell → choice. Blank → the DSP preset. "Owner" is never taken from a sheet. */
export function resolvePresetCell(raw: string, agency: ImportAgency): AccessChoice | "" {
  const key = slugCell(raw);
  if (!key) return defaultStaffPresetId(agency.presets) ?? "";
  if (key === OWNER_ACCESS) return "";
  const preset = agency.presets.find((p) => slugCell(p.name) === key);
  if (!preset) return "";
  if (preset.access_level !== "staff" && !agency.viewerIsOwner) return "";
  return preset.id;
}

export function resolveHomeCell(raw: string, agency: ImportAgency): string {
  const key = slugCell(raw);
  if (!key) return "";
  return agency.homes.find((h) => slugCell(h.name) === key)?.id ?? "";
}

/** Position cell: labels or keys separated by ";" or ",". Unknown names are dropped (and flagged). */
export function resolvePositionCell(raw: string, agency: ImportAgency): string[] {
  const out: string[] = [];
  for (const part of raw.split(/[;,]/)) {
    const key = slugCell(part);
    if (!key) continue;
    const hit = agency.positions.find((p) => slugCell(p.label) === key || slugCell(p.key) === key);
    if (hit && !out.includes(hit.key)) out.push(hit.key);
  }
  return out;
}

function positionPartsCount(raw: string): number {
  return raw.split(/[;,]/).filter((p) => slugCell(p)).length;
}

function newRowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type RawParts = Partial<Record<TeamImportColumn, unknown>>;

function cellText(v: unknown): string {
  return String(v ?? "").trim();
}

export function draftFromParts(parts: RawParts, agency: ImportAgency): TeamImportDraft {
  const first = cellText(parts.first_name);
  const last = cellText(parts.last_name);
  const names =
    first || last ? { first_name: first, last_name: last } : splitPersonName(cellText(parts.name));
  const preset = cellText(parts.preset);
  const home = cellText(parts.home);
  const position = cellText(parts.position);
  const transportsRaw = cellText(parts.transports);
  return {
    id: newRowId(),
    ...names,
    email: normalizeSignupEmail(cellText(parts.email)),
    phone: cellText(parts.phone),
    hire_date: normalizeImportDate(parts.hire_date),
    date_of_birth: normalizeImportDate(parts.date_of_birth),
    job_title: cellText(parts.job_title),
    preset,
    access: resolvePresetCell(preset, agency),
    home,
    homeId: resolveHomeCell(home, agency),
    position,
    positions: resolvePositionCell(position, agency),
    transports: parseYesNo(transportsRaw) === true,
    transportsRaw,
  };
}

export function emptyTeamImportDraft(agency: ImportAgency): TeamImportDraft {
  return draftFromParts({}, agency);
}

export type ParsedTeamImport = { rows: TeamImportDraft[]; ignoredColumns: string[] };

/** Shared by paste, CSV and Excel: a header row (exact match) or the paste column order. */
export function parseTeamImportGrid(
  grid: ReadonlyArray<readonly unknown[]>,
  agency: ImportAgency,
): ParsedTeamImport {
  const lines = grid.filter((cells) => cells.some((c) => cellText(c)));
  if (!lines.length) return { rows: [], ignoredColumns: [] };
  const hasHeader = isHeaderRow(lines[0] ?? []);
  const header = hasHeader ? (lines[0] ?? []) : [];
  const columns: Array<TeamImportColumn | null> = hasHeader
    ? header.map(columnForHeader)
    : [...TEAM_IMPORT_PASTE_ORDER];
  const ignoredColumns = hasHeader
    ? header.filter((h, i) => cellText(h) && !columns[i]).map((h) => cellText(h))
    : [];
  const rows = lines.slice(hasHeader ? 1 : 0).map((cells) => {
    const parts: RawParts = {};
    cells.forEach((value, i) => {
      const col = columns[i];
      if (!col || !cellText(value)) return;
      parts[col] = parts[col] ? `${cellText(parts[col])} ${cellText(value)}` : value;
    });
    return draftFromParts(parts, agency);
  });
  return { rows, ignoredColumns };
}

function splitPasteLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t");
  const parsed = Papa.parse<string[]>(line, { header: false, skipEmptyLines: true });
  const row = parsed.data?.[0];
  return Array.isArray(row) ? row.map((c) => String(c ?? "")) : [line];
}

export function parseTeamImportText(text: string, agency: ImportAgency): ParsedTeamImport {
  const grid = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map(splitPasteLine);
  return parseTeamImportGrid(grid, agency);
}

/** CSV or Excel bytes → grid. Excel keeps raw cell values so serial dates stay numbers. */
export function gridFromWorkbook(buf: ArrayBuffer): unknown[][] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
}

export async function parseTeamImportFile(
  file: File,
  agency: ImportAgency,
): Promise<ParsedTeamImport> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv" || name.endsWith(".txt")) {
    return parseTeamImportText(await file.text(), agency);
  }
  return parseTeamImportGrid(gridFromWorkbook(await file.arrayBuffer()), agency);
}

/* ------------------------------------------------------------------ */
/* Review                                                              */
/* ------------------------------------------------------------------ */

function duplicateEmails(rows: readonly TeamImportDraft[]): Set<string> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const email = normalizeSignupEmail(row.email);
    if (email) counts.set(email, (counts.get(email) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, n]) => n > 1).map(([e]) => e));
}

export function validateTeamImportRows(
  rows: readonly TeamImportDraft[],
  agency: ImportAgency,
  today: string = new Date().toISOString().slice(0, 10),
): Map<string, TeamImportIssue[]> {
  const issues = new Map<string, TeamImportIssue[]>();
  const dups = duplicateEmails(rows);
  const presetNames = agency.presets
    .filter((p) => p.access_level === "staff" || agency.viewerIsOwner)
    .map((p) => p.name);
  for (const row of rows) {
    const list: TeamImportIssue[] = [];
    if (!row.first_name.trim() || !row.last_name.trim()) {
      list.push({ field: "name", message: "Enter a first and last name." });
    }
    if (!row.email.trim()) list.push({ field: "email", message: "Email is required." });
    else if (!isValidSignupEmail(row.email)) {
      list.push({ field: "email", message: "Enter a valid email." });
    } else if (dups.has(normalizeSignupEmail(row.email))) {
      list.push({ field: "email", message: "This email is listed more than once." });
    }
    if (!row.hire_date.trim()) list.push({ field: "hire_date", message: "Hire date is required." });
    else if (!isYmd(row.hire_date)) {
      list.push({ field: "hire_date", message: "Use YYYY-MM-DD or M/D/YYYY." });
    }
    if (row.date_of_birth && !isYmd(row.date_of_birth)) {
      list.push({ field: "date_of_birth", message: "Use YYYY-MM-DD or M/D/YYYY." });
    } else if (row.date_of_birth && row.date_of_birth >= today) {
      list.push({ field: "date_of_birth", message: "Date of birth must be in the past." });
    }
    if (!row.access) {
      const typed = row.preset.trim();
      list.push({
        field: "preset",
        message:
          slugCell(typed) === OWNER_ACCESS
            ? "Owner can't be given from a spreadsheet."
            : typed
              ? `"${typed}" isn't an access preset you can give. Use ${presetNames.join(", ")}.`
              : "Choose an access preset.",
      });
    }
    if (row.home.trim() && !row.homeId) {
      list.push({ field: "home", message: `"${row.home.trim()}" isn't one of your homes.` });
    }
    if (positionPartsCount(row.position) > row.positions.length) {
      list.push({ field: "position", message: "One or more positions aren't set up here." });
    }
    if (parseYesNo(row.transportsRaw) === null) {
      list.push({ field: "transports", message: "Transports must be yes or no." });
    }
    if (list.length) issues.set(row.id, list);
  }
  return issues;
}

export function rowHasIssue(
  issues: Map<string, TeamImportIssue[]>,
  rowId: string,
  field: TeamImportIssueField,
): boolean {
  return (issues.get(rowId) ?? []).some((i) => i.field === field);
}

/** The importTeamMembers row for a reviewed draft. */
export function importPayloadRow(row: TeamImportDraft) {
  return {
    firstName: row.first_name.trim(),
    lastName: row.last_name.trim(),
    email: normalizeSignupEmail(row.email),
    phone: row.phone.trim(),
    hireDate: row.hire_date,
    dateOfBirth: row.date_of_birth,
    access: row.access as AccessChoice,
    positions: row.positions,
    homeId: row.homeId || null,
    jobTitle: row.job_title.trim(),
    workerType: "w2" as const,
    transportsClients: row.transports,
  };
}

export function importTooMany(rows: readonly unknown[]): boolean {
  return rows.length > IMPORT_MAX_ROWS;
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

/** Preset names this viewer may give, Team member presets first. */
export function templatePresetNames(agency: ImportAgency): string[] {
  const staff = agency.presets.filter((p) => p.access_level === "staff").map((p) => p.name);
  const admin = agency.viewerIsOwner
    ? agency.presets.filter((p) => p.access_level === "admin").map((p) => p.name)
    : [];
  return [...staff.sort(), ...admin.sort()];
}

export function templateExampleRow(
  agency: ImportAgency,
): Record<(typeof TEAM_IMPORT_HEADERS)[number], string> {
  const presetId = defaultStaffPresetId(agency.presets);
  return {
    first_name: "Jane",
    last_name: "Doe",
    email: "jane.doe@example.com",
    phone: "555-123-4567",
    hire_date: "2026-07-01",
    preset:
      agency.presets.find((p) => p.id === presetId)?.name ?? templatePresetNames(agency)[0] ?? "",
    home: agency.homes[0]?.name ?? "",
    job_title: "",
    position: agency.positions[0]?.label ?? "",
    date_of_birth: "",
    transports: "no",
  };
}

export function buildTeamImportTemplateCsv(agency: ImportAgency): string {
  return Papa.unparse({ fields: [...TEAM_IMPORT_HEADERS], data: [templateExampleRow(agency)] });
}

function columnLetter(header: (typeof TEAM_IMPORT_HEADERS)[number]): string {
  return String.fromCharCode("A".charCodeAt(0) + TEAM_IMPORT_HEADERS.indexOf(header));
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Excel template: the Team members sheet plus a Lists sheet holding the agency's
 * preset, home and position names. Preset, Home and Transports get real list
 * dropdowns that point at the Lists sheet (no 255-character inline limit).
 */
export async function buildTeamImportTemplateXlsx(agency: ImportAgency): Promise<Uint8Array> {
  const example = templateExampleRow(agency);
  const ws = XLSX.utils.json_to_sheet([example], { header: [...TEAM_IMPORT_HEADERS] });
  ws["!cols"] = TEAM_IMPORT_HEADERS.map((h) => ({
    wch: Math.max(h.length, String(example[h]).length, 16),
  }));
  const presetNames = templatePresetNames(agency);
  const homeNames = agency.homes.map((h) => h.name);
  const positionNames = agency.positions.map((p) => p.label);
  const listRows = Math.max(presetNames.length, homeNames.length, positionNames.length, 2);
  const lists: string[][] = [["Presets", "Homes", "Positions", "Transports"]];
  for (let i = 0; i < listRows; i += 1) {
    lists.push([
      presetNames[i] ?? "",
      homeNames[i] ?? "",
      positionNames[i] ?? "",
      i === 0 ? "yes" : i === 1 ? "no" : "",
    ]);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Team members");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lists), "Lists");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

  const validations: string[] = [];
  const addList = (
    header: (typeof TEAM_IMPORT_HEADERS)[number],
    listCol: string,
    count: number,
    title: string,
  ) => {
    if (!count) return;
    const col = columnLetter(header);
    validations.push(
      `<dataValidation type="list" allowBlank="1" showErrorMessage="1" ` +
        `errorTitle="${xmlEscape(title)}" error="${xmlEscape(`Choose a ${title.toLowerCase()} from the list.`)}" ` +
        `sqref="${col}2:${col}${IMPORT_MAX_ROWS + 1}">` +
        `<formula1>Lists!$${listCol}$2:$${listCol}$${count + 1}</formula1></dataValidation>`,
    );
  };
  addList("preset", "A", presetNames.length, "Preset");
  addList("home", "B", homeNames.length, "Home");
  addList("transports", "D", 2, "Transports");
  if (!validations.length) return new Uint8Array(out);

  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(out);
  const sheetPath = "xl/worksheets/sheet1.xml";
  const file = zip.file(sheetPath);
  if (!file) throw new Error("Excel template is missing a worksheet.");
  const xml = await file.async("string");
  if (!xml.includes("</worksheet>")) throw new Error("Excel template worksheet is incomplete.");
  const block = `<dataValidations count="${validations.length}">${validations.join("")}</dataValidations>`;
  // dataValidations sits before pageMargins in the worksheet schema order.
  const at = xml.includes("<pageMargins") ? "<pageMargins" : "</worksheet>";
  zip.file(sheetPath, xml.replace(at, `${block}${at}`));
  return zip.generateAsync({ type: "uint8array" });
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadTeamImportTemplateCsv(agency: ImportAgency): void {
  download(
    new Blob([buildTeamImportTemplateCsv(agency)], { type: "text/csv" }),
    "team-member-import-template.csv",
  );
}

export async function downloadTeamImportTemplateXlsx(agency: ImportAgency): Promise<void> {
  const bytes = await buildTeamImportTemplateXlsx(agency);
  download(
    new Blob([bytes.buffer as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "team-member-import-template.xlsx",
  );
}
