/**
 * Import several clients from a spreadsheet (no AI). Columns are only the Add
 * client first step; code dates and units come later (PCSP or by hand), so
 * every code is saved as waiting on the 1056. Each reviewed row becomes an
 * AddClientForm and is saved through addClient, the same as Add client.
 * Cell rules are shared with the team member import (../spreadsheet-import/).
 */
import { EVV_SERVICE_CODES, padMemberId } from "../evv-codes.ts";
import {
  cellText,
  isYmd,
  newRowId,
  normalizeImportDate,
  parseYesNo,
  readGrid,
  slugCell,
  splitCodeList,
} from "../spreadsheet-import/cells.ts";
import { emptyAddClientForm, normalizeMedicaidId, type AddClientForm } from "./create.ts";

export const CLIENT_IMPORT_COLUMNS = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "date_of_birth", label: "Date of birth" },
  { key: "medicaid_id", label: "Medicaid ID" },
  { key: "client_pid", label: "DSPD PID" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "start_date", label: "Start date" },
  { key: "home", label: "Home" },
  { key: "own_guardian", label: "Own guardian (Y/N)" },
  { key: "guardian_name", label: "Guardian name" },
  { key: "guardian_relationship", label: "Guardian relationship" },
  { key: "guardian_phone", label: "Guardian phone" },
  { key: "guardian_email", label: "Guardian email" },
  { key: "sc_name", label: "Support coordinator name" },
  { key: "sc_phone", label: "Support coordinator phone" },
  { key: "sc_email", label: "Support coordinator email" },
  { key: "sc_agency", label: "Support coordinator agency" },
  { key: "codes", label: "Service codes" },
] as const;

export type ClientImportColumn = (typeof CLIENT_IMPORT_COLUMNS)[number]["key"];
export const CLIENT_IMPORT_HEADERS = CLIENT_IMPORT_COLUMNS.map((c) => c.label);

const ALIASES: Record<string, ClientImportColumn> = {
  ...Object.fromEntries(CLIENT_IMPORT_COLUMNS.map((c) => [slugCell(c.label), c.key])),
  ...Object.fromEntries(CLIENT_IMPORT_COLUMNS.map((c) => [c.key, c.key])),
  dob: "date_of_birth",
  birth_date: "date_of_birth",
  medicaid: "medicaid_id",
  medicaid_number: "medicaid_id",
  pid: "client_pid",
  dspd_pid: "client_pid",
  phone_number: "phone",
  service_address: "address",
  admission_date: "start_date",
  is_own_guardian: "own_guardian",
  service_codes: "codes",
  dspd_codes: "codes",
};

export function clientColumnForHeader(raw: unknown): ClientImportColumn | null {
  return ALIASES[slugCell(raw)] ?? null;
}

/** The header has at least three known columns, so a title line never counts. */
export function isClientHeaderRow(cells: readonly unknown[]): boolean {
  return new Set(cells.map(clientColumnForHeader).filter(Boolean)).size >= 3;
}

export type ClientImportDraft = { id: string } & Record<ClientImportColumn, string>;

export type ClientImportAgency = { homes: ReadonlyArray<{ id: string; name: string }> };

function draftFrom(parts: Partial<Record<ClientImportColumn, unknown>>): ClientImportDraft {
  const out = { id: newRowId() } as ClientImportDraft;
  for (const { key } of CLIENT_IMPORT_COLUMNS) {
    const v = parts[key];
    out[key] =
      key === "date_of_birth" || key === "start_date"
        ? normalizeImportDate(v)
        : key === "medicaid_id" && typeof v === "number"
          ? padMemberId(String(v))
          : key === "codes"
            ? splitCodeList(v).join("; ")
            : cellText(v);
  }
  return out;
}

export function emptyClientImportDraft(): ClientImportDraft {
  return draftFrom({});
}

export type ParsedClientImport = {
  rows: ClientImportDraft[];
  ignoredColumns: string[];
  headerFound: boolean;
};

/** Grid (paste, CSV or Excel) → drafts. Rows above the header row are skipped. */
export function parseClientImportGrid(grid: ReadonlyArray<readonly unknown[]>): ParsedClientImport {
  const { records, ignoredColumns, headerFound } = readGrid(grid, {
    columnFor: clientColumnForHeader,
    isHeader: isClientHeaderRow,
    pasteOrder: null,
  });
  return { rows: records.map(draftFrom), ignoredColumns, headerFound };
}

/** Own guardian: Y/N; blank → yes unless a guardian name is filled in. null = not yes/no. */
export function ownGuardianValue(row: Pick<ClientImportDraft, "own_guardian" | "guardian_name">) {
  if (!row.own_guardian.trim()) return !row.guardian_name.trim();
  return parseYesNo(row.own_guardian);
}

export function resolveHome(raw: string, agency: ClientImportAgency): string | null {
  const key = slugCell(raw);
  return key ? (agency.homes.find((h) => slugCell(h.name) === key)?.id ?? null) : null;
}

const KNOWN_CODES = new Set(EVV_SERVICE_CODES.map((c) => c.code));

/** A reviewed row as the Add client form (codes waiting on the 1056). */
export function clientImportForm(
  row: ClientImportDraft,
  agency: ClientImportAgency,
): AddClientForm {
  const person = (name: string, phone: string, email: string, relationship = "", company = "") => ({
    name,
    phone,
    email,
    relationship,
    company,
  });
  return {
    ...emptyAddClientForm(),
    first_name: row.first_name,
    last_name: row.last_name,
    date_of_birth: isYmd(row.date_of_birth) ? row.date_of_birth : null,
    medicaid_id: row.medicaid_id,
    client_pid: row.client_pid,
    phone: row.phone,
    address: row.address,
    start_date: isYmd(row.start_date) ? row.start_date : null,
    home_id: resolveHome(row.home, agency),
    is_own_guardian: ownGuardianValue(row) !== false,
    guardian: person(
      row.guardian_name,
      row.guardian_phone,
      row.guardian_email,
      row.guardian_relationship,
    ),
    support_coordinator: person(row.sc_name, row.sc_phone, row.sc_email, "", row.sc_agency),
    codes: splitCodeList(row.codes).map((code) => ({
      code,
      waiting: true,
      start: null,
      end: null,
      units: null,
      rate: null,
    })),
  };
}

export type ClientImportIssue = { field: ClientImportColumn; message: string };

/** Existing clients with a Medicaid ID (for duplicate checks). */
export type ExistingMedicaid = { medicaidId: string; name: string };

/** Problems per row id, each tied to the cell it's about. */
export function validateClientImportRows(
  rows: readonly ClientImportDraft[],
  agency: ClientImportAgency,
  existing: readonly ExistingMedicaid[],
  today: string = new Date().toISOString().slice(0, 10),
): Map<string, ClientImportIssue[]> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const id = normalizeMedicaidId(r.medicaid_id);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const taken = new Map(existing.map((e) => [normalizeMedicaidId(e.medicaidId), e.name]));
  const out = new Map<string, ClientImportIssue[]>();
  for (const r of rows) {
    const list: ClientImportIssue[] = [];
    const add = (field: ClientImportColumn, message: string) => list.push({ field, message });
    if (!r.first_name.trim()) add("first_name", "First name is required.");
    if (!r.last_name.trim()) add("last_name", "Last name is required.");
    const mid = normalizeMedicaidId(r.medicaid_id);
    if (!mid) add("medicaid_id", "Medicaid ID is required.");
    else if (taken.has(mid)) add("medicaid_id", `Already used by ${taken.get(mid)}.`);
    else if ((counts.get(mid) ?? 0) > 1)
      add("medicaid_id", "This Medicaid ID is listed more than once.");
    if (!r.address.trim()) add("address", "Address is required.");
    for (const key of ["date_of_birth", "start_date"] as const) {
      if (r[key] && !isYmd(r[key])) add(key, "Use a date like 9/1/2026.");
    }
    if (isYmd(r.date_of_birth) && r.date_of_birth >= today)
      add("date_of_birth", "Date of birth must be in the past.");
    if (r.home.trim() && !resolveHome(r.home, agency))
      add("home", `"${r.home.trim()}" isn't one of your homes.`);
    const own = ownGuardianValue(r);
    if (own === null) add("own_guardian", "Use Y or N.");
    if (own === false && !r.guardian_name.trim())
      add("guardian_name", "Guardian name is required.");
    if (own === false && !r.guardian_phone.trim())
      add("guardian_phone", "Guardian phone is required.");
    const unknown = splitCodeList(r.codes).filter((c) => !KNOWN_CODES.has(c));
    if (unknown.length)
      add("codes", `Not a DSPD service code: ${unknown.join(", ")}. Separate codes with ";".`);
    if (list.length) out.set(r.id, list);
  }
  return out;
}
