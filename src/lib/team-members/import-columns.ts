/**
 * Team member import columns: the template's columns (the Add team member
 * form's, in its order and wording), header aliases and how typed names
 * resolve to the agency's presets, homes, supervisors and positions.
 */
import { slugCell } from "../spreadsheet-import/cells.ts";
import {
  OWNER_ACCESS,
  defaultStaffPresetId,
  type AccessChoice,
  type PresetPick,
} from "./add-member.ts";

/** Template columns, in the Add team member form's order and wording. */
export const TEAM_IMPORT_COLUMNS = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "hire_date", label: "Hire date" },
  { key: "position", label: "Position" },
  { key: "preset", label: "Access" },
  { key: "home", label: "Home" },
  { key: "supervisor", label: "Supervisor" },
  { key: "date_of_birth", label: "Date of birth" },
  { key: "worker_type", label: "Worker type" },
  { key: "transports", label: "Transports clients" },
] as const;

export type TeamTemplateKey = (typeof TEAM_IMPORT_COLUMNS)[number]["key"];
export type TeamImportColumn = TeamTemplateKey | "name";

export const TEAM_IMPORT_HEADERS = TEAM_IMPORT_COLUMNS.map((c) => c.label);

/** Column order for a paste with no header row. */
export const TEAM_IMPORT_PASTE_ORDER: readonly TeamImportColumn[] = [
  "name",
  ...TEAM_IMPORT_COLUMNS.slice(2).map((c) => c.key),
];

export type ImportAgency = {
  presets: ReadonlyArray<PresetPick & { seed_key?: string | null }>;
  homes: ReadonlyArray<{ id: string; name: string }>;
  positions: ReadonlyArray<{ key: string; label: string }>;
  /** memberId = organization_members.id (what supervisorId takes). */
  supervisors: ReadonlyArray<{ memberId: string; name: string }>;
  /** Owner / Admin presets are only assignable by an Owner. */
  viewerIsOwner: boolean;
};

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
  supervisor: "supervisor",
  manager: "supervisor",
  reports_to: "supervisor",
  position: "position",
  positions: "position",
  date_of_birth: "date_of_birth",
  dob: "date_of_birth",
  birth_date: "date_of_birth",
  birthdate: "date_of_birth",
  worker_type: "worker_type",
  employment_type: "worker_type",
  transports: "transports",
  transports_clients: "transports",
  transport: "transports",
  drives_clients: "transports",
};

/** Exact header cell → column, or null. */
export function columnForHeader(raw: unknown): TeamImportColumn | null {
  return HEADER_ALIASES[slugCell(raw)] ?? null;
}

/**
 * A row is the header when a cell is exactly an Email header, or at least two
 * cells are exactly known headers. "Jane Email-Smith" is not a header.
 */
export function isHeaderRow(cells: readonly unknown[]): boolean {
  const cols = cells.map(columnForHeader).filter((c): c is TeamImportColumn => !!c);
  return cols.includes("email") || new Set(cols).size >= 2;
}

export function splitPersonName(raw: string): { first_name: string; last_name: string } {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return { first_name: "", last_name: "" };
  const idx = t.lastIndexOf(" ");
  if (idx <= 0) return { first_name: t, last_name: "" };
  return { first_name: t.slice(0, idx), last_name: t.slice(idx + 1) };
}

/** Access cell → choice. Blank → the DSP preset. "Owner" is never taken from a sheet. */
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

export function resolveSupervisorCell(raw: string, agency: ImportAgency): string {
  const key = slugCell(raw);
  if (!key) return "";
  return agency.supervisors.find((s) => slugCell(s.name) === key)?.memberId ?? "";
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

export function positionPartsCount(raw: string): number {
  return raw.split(/[;,]/).filter((p) => slugCell(p)).length;
}

/** Preset names this viewer may give, Team member presets first. */
export function templatePresetNames(agency: ImportAgency): string[] {
  const staff = agency.presets.filter((p) => p.access_level === "staff").map((p) => p.name);
  const admin = agency.viewerIsOwner
    ? agency.presets.filter((p) => p.access_level === "admin").map((p) => p.name)
    : [];
  return [...staff.sort(), ...admin.sort()];
}
