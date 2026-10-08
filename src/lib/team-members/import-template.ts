/**
 * Team member import templates (CSV and Excel), built from the agency's own
 * access presets, homes, positions and supervisors. Excel adds list dropdowns
 * and a "How to fill this in" sheet.
 */
import {
  buildXlsxTemplate,
  downloadCsv,
  downloadXlsx,
  templateCsv,
} from "../spreadsheet-import/files.ts";
import {
  IMPORT_MAX_ROWS,
  WORKER_TYPE_LABEL,
  WORKER_TYPES,
  defaultStaffPresetId,
} from "./add-member.ts";
import {
  TEAM_IMPORT_COLUMNS,
  TEAM_IMPORT_HEADERS,
  templatePresetNames,
  type ImportAgency,
  type TeamTemplateKey,
} from "./import-columns.ts";

export function templateExampleRow(agency: ImportAgency): Record<TeamTemplateKey, string> {
  const presetId = defaultStaffPresetId(agency.presets);
  return {
    first_name: "Jane",
    last_name: "Doe",
    email: "jane.doe@example.com",
    phone: "555-123-4567",
    hire_date: "7/1/2026",
    position: agency.positions[0]?.label ?? "",
    preset:
      agency.presets.find((p) => p.id === presetId)?.name ?? templatePresetNames(agency)[0] ?? "",
    home: agency.homes[0]?.name ?? "",
    supervisor: "",
    date_of_birth: "",
    worker_type: WORKER_TYPE_LABEL.w2,
    transports: "no",
  };
}

const NOTES: Record<TeamTemplateKey, string> = {
  first_name: "Required.",
  last_name: "Required.",
  email: "Required. They sign in with it; one person per email.",
  phone: "Optional.",
  hire_date: "Required. A date like 7/1/2026.",
  position: "Optional. One or more of your positions, separated by ;",
  preset: "Required. Pick from the list. Owner can't be given from a spreadsheet.",
  home: "Optional. Pick one of your homes.",
  supervisor: "Optional. An active team member's full name.",
  date_of_birth: "Optional. A date like 1/2/1990.",
  worker_type: "Optional. W2, 1099, Volunteer or Other. Blank means W2.",
  transports: "Yes or no. Blank means no.",
};

function exampleCells(agency: ImportAgency): string[] {
  const example = templateExampleRow(agency);
  return TEAM_IMPORT_COLUMNS.map((c) => example[c.key]);
}

export function buildTeamImportTemplateCsv(agency: ImportAgency): string {
  return templateCsv(TEAM_IMPORT_HEADERS, exampleCells(agency));
}

const col = (key: TeamTemplateKey) => TEAM_IMPORT_COLUMNS.findIndex((c) => c.key === key);

export async function buildTeamImportTemplateXlsx(agency: ImportAgency): Promise<Uint8Array> {
  const presets = templatePresetNames(agency);
  const homes = agency.homes.map((h) => h.name);
  const positions = agency.positions.map((p) => p.label);
  const supervisors = agency.supervisors.map((s) => s.name);
  const workerTypes = WORKER_TYPES.map((w) => WORKER_TYPE_LABEL[w]);
  const count = Math.max(presets.length, homes.length, positions.length, supervisors.length, 4);
  const lists: string[][] = [
    ["Access", "Homes", "Positions", "Transports clients", "Supervisors", "Worker types"],
  ];
  for (let i = 0; i < count; i += 1) {
    lists.push([
      presets[i] ?? "",
      homes[i] ?? "",
      positions[i] ?? "",
      ["yes", "no"][i] ?? "",
      supervisors[i] ?? "",
      workerTypes[i] ?? "",
    ]);
  }
  return buildXlsxTemplate({
    sheetName: "Team members",
    headers: TEAM_IMPORT_HEADERS,
    example: exampleCells(agency),
    notes: TEAM_IMPORT_COLUMNS.map((c) => [c.label, NOTES[c.key]] as const),
    lists,
    maxRows: IMPORT_MAX_ROWS,
    dropdowns: [
      { column: col("preset"), listColumn: "A", count: presets.length, title: "Access" },
      { column: col("home"), listColumn: "B", count: homes.length, title: "Home" },
      { column: col("transports"), listColumn: "D", count: 2, title: "Transports clients" },
      {
        column: col("supervisor"),
        listColumn: "E",
        count: supervisors.length,
        title: "Supervisor",
      },
      {
        column: col("worker_type"),
        listColumn: "F",
        count: workerTypes.length,
        title: "Worker type",
      },
    ],
  });
}

export function downloadTeamImportTemplateCsv(agency: ImportAgency): void {
  downloadCsv(buildTeamImportTemplateCsv(agency), "team-member-import-template.csv");
}

export async function downloadTeamImportTemplateXlsx(agency: ImportAgency): Promise<void> {
  downloadXlsx(await buildTeamImportTemplateXlsx(agency), "team-member-import-template.xlsx");
}
