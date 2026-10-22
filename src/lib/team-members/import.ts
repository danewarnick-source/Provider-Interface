/**
 * Import team members from a paste, CSV or Excel file: rows → drafts, review
 * issues per cell, and the importTeamMembers payload. Columns and name
 * matching live in import-columns.ts; cell rules and file reading are shared
 * with the client import (src/lib/spreadsheet-import/). Existing people are
 * never updated from here.
 */
import { isValidSignupEmail, normalizeSignupEmail } from "../signup-email.ts";
import {
  cellText,
  isYmd,
  newRowId,
  normalizeImportDate,
  parseYesNo,
  readGrid,
  slugCell,
} from "../spreadsheet-import/cells.ts";
import { gridFromFile, gridFromText } from "../spreadsheet-import/files.ts";
import {
  IMPORT_MAX_ROWS,
  OWNER_ACCESS,
  parseWorkerType,
  type AccessChoice,
  type WorkerType,
} from "./add-member.ts";
import {
  TEAM_IMPORT_PASTE_ORDER,
  columnForHeader,
  isHeaderRow,
  positionPartsCount,
  resolveHomeCell,
  resolvePositionCell,
  resolvePresetCell,
  resolveSupervisorCell,
  splitPersonName,
  templatePresetNames,
  type ImportAgency,
  type TeamImportColumn,
} from "./import-columns.ts";

export type TeamImportDraft = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  /** YYYY-MM-DD when parseable, else the raw text (flagged). */
  hire_date: string;
  date_of_birth: string;
  /** Access as typed; `access` is the resolved choice ("" when unknown). */
  preset: string;
  access: AccessChoice | "";
  /** Home as typed; `homeId` is the resolved team id ("" = none / unknown). */
  home: string;
  homeId: string;
  /** Supervisor as typed; `supervisorId` is their membership id ("" = none / unknown). */
  supervisor: string;
  supervisorId: string;
  workerType: WorkerType;
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
  | "supervisor"
  | "position"
  | "transports";

export type TeamImportIssue = { field: TeamImportIssueField; message: string };

type RawParts = Partial<Record<TeamImportColumn, unknown>>;

export function draftFromParts(parts: RawParts, agency: ImportAgency): TeamImportDraft {
  const first = cellText(parts.first_name);
  const last = cellText(parts.last_name);
  const names =
    first || last ? { first_name: first, last_name: last } : splitPersonName(cellText(parts.name));
  const preset = cellText(parts.preset);
  const home = cellText(parts.home);
  const supervisor = cellText(parts.supervisor);
  const position = cellText(parts.position);
  const transportsRaw = cellText(parts.transports);
  return {
    id: newRowId(),
    ...names,
    email: normalizeSignupEmail(cellText(parts.email)),
    phone: cellText(parts.phone),
    hire_date: normalizeImportDate(parts.hire_date),
    date_of_birth: normalizeImportDate(parts.date_of_birth),
    preset,
    access: resolvePresetCell(preset, agency),
    home,
    homeId: resolveHomeCell(home, agency),
    supervisor,
    supervisorId: resolveSupervisorCell(supervisor, agency),
    workerType: parseWorkerType(cellText(parts.worker_type)),
    position,
    positions: resolvePositionCell(position, agency),
    transports: parseYesNo(transportsRaw) === true,
    transportsRaw,
  };
}

export type ParsedTeamImport = { rows: TeamImportDraft[]; ignoredColumns: string[] };

/** Shared by paste, CSV and Excel: a header row (exact match) or the paste column order. */
export function parseTeamImportGrid(
  grid: ReadonlyArray<readonly unknown[]>,
  agency: ImportAgency,
): ParsedTeamImport {
  const { records, ignoredColumns } = readGrid(grid, {
    columnFor: columnForHeader,
    isHeader: isHeaderRow,
    pasteOrder: TEAM_IMPORT_PASTE_ORDER,
  });
  return { rows: records.map((parts) => draftFromParts(parts, agency)), ignoredColumns };
}

export function parseTeamImportText(text: string, agency: ImportAgency): ParsedTeamImport {
  return parseTeamImportGrid(gridFromText(text), agency);
}

export async function parseTeamImportFile(
  file: File,
  agency: ImportAgency,
): Promise<ParsedTeamImport> {
  return parseTeamImportGrid(await gridFromFile(file), agency);
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

function dateIssue(value: string, required: string | null): string | null {
  if (!value.trim()) return required;
  return isYmd(value) ? null : "Use a date like 9/1/2026.";
}

export function validateTeamImportRows(
  rows: readonly TeamImportDraft[],
  agency: ImportAgency,
  today: string = new Date().toISOString().slice(0, 10),
): Map<string, TeamImportIssue[]> {
  const issues = new Map<string, TeamImportIssue[]>();
  const dups = duplicateEmails(rows);
  const presetNames = templatePresetNames(agency);
  for (const row of rows) {
    const list: TeamImportIssue[] = [];
    const add = (field: TeamImportIssueField, message: string | null) => {
      if (message) list.push({ field, message });
    };
    if (!row.first_name.trim() || !row.last_name.trim())
      add("name", "Enter a first and last name.");
    if (!row.email.trim()) add("email", "Email is required.");
    else if (!isValidSignupEmail(row.email)) add("email", "Enter a valid email.");
    else if (dups.has(normalizeSignupEmail(row.email)))
      add("email", "This email is listed more than once.");
    add("hire_date", dateIssue(row.hire_date, "Hire date is required."));
    const dob = dateIssue(row.date_of_birth, null);
    add(
      "date_of_birth",
      dob ??
        (row.date_of_birth && row.date_of_birth >= today
          ? "Date of birth must be in the past."
          : null),
    );
    if (!row.access) {
      const typed = row.preset.trim();
      add(
        "preset",
        slugCell(typed) === OWNER_ACCESS
          ? "Owner can't be given from a spreadsheet."
          : typed
            ? `"${typed}" isn't an access preset you can give. Use ${presetNames.join(", ")}.`
            : "Choose Access.",
      );
    }
    if (row.home.trim() && !row.homeId)
      add("home", `"${row.home.trim()}" isn't one of your homes.`);
    if (row.supervisor.trim() && !row.supervisorId)
      add("supervisor", `"${row.supervisor.trim()}" isn't an active team member here.`);
    if (positionPartsCount(row.position) > row.positions.length)
      add("position", "One or more positions aren't set up here.");
    if (parseYesNo(row.transportsRaw) === null) add("transports", "Transports must be yes or no.");
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
    supervisorId: row.supervisorId || null,
    workerType: row.workerType,
    transportsClients: row.transports,
  };
}

export function importTooMany(rows: readonly unknown[]): boolean {
  return rows.length > IMPORT_MAX_ROWS;
}
