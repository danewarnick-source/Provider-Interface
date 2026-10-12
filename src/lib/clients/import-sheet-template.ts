/**
 * Client import templates (Excel and CSV): the Add client first-step columns,
 * one made-up example row and a "How to fill this in" note. Excel puts the
 * note on its own sheet and gives Home and Own guardian dropdowns; CSV puts a
 * one-line note above the header (the import skips lines above the header).
 */
import { IMPORT_MAX_ROWS } from "../team-members/add-member.ts";
import {
  buildXlsxTemplate,
  downloadCsv,
  downloadXlsx,
  templateCsv,
} from "../spreadsheet-import/files.ts";
import {
  CLIENT_IMPORT_COLUMNS,
  CLIENT_IMPORT_HEADERS,
  type ClientImportAgency,
  type ClientImportColumn,
} from "./import-sheet.ts";

/** Made-up person; never real data. */
export function clientTemplateExample(
  agency: ClientImportAgency,
): Record<ClientImportColumn, string> {
  return {
    first_name: "Pat",
    last_name: "Example",
    date_of_birth: "4/12/1995",
    medicaid_id: "0000000001",
    client_pid: "1234567",
    phone: "555-0100",
    address: "100 Sample St, Salt Lake City, UT 84101",
    start_date: "9/1/2026",
    home: agency.homes[0]?.name ?? "",
    own_guardian: "N",
    guardian_name: "Gale Example",
    guardian_relationship: "Parent",
    guardian_phone: "555-0101",
    guardian_email: "gale@example.com",
    sc_name: "Casey Sample",
    sc_phone: "555-0102",
    sc_email: "casey@example.com",
    sc_agency: "Sample Support Coordination",
    codes: "SLH; DSI",
  };
}

export const CLIENT_TEMPLATE_NOTES: Record<ClientImportColumn, string> = {
  first_name: "Required.",
  last_name: "Required.",
  date_of_birth: "A date like 4/12/1995.",
  medicaid_id: "Required. Each client's Medicaid ID once; clients already here are flagged.",
  client_pid: "Optional.",
  phone: "Optional.",
  address: "Required. Where services happen: street, city, state, ZIP.",
  start_date: "When services start, like 9/1/2026.",
  home: "Optional. One of your homes, spelled the same.",
  own_guardian: "Y or N. N means fill in the guardian's name and phone.",
  guardian_name: "Needed when Own guardian is N.",
  guardian_relationship: "Optional, like Parent.",
  guardian_phone: "Needed when Own guardian is N.",
  guardian_email: "Optional.",
  sc_name: "Optional.",
  sc_phone: "Optional.",
  sc_email: "Optional.",
  sc_agency: "Optional.",
  codes: 'DSPD codes separated by ";", like SLH; DSI. Dates and units come later.',
};

export const CLIENT_TEMPLATE_CSV_NOTE =
  "How to fill this in: one client per row under the header. Replace the example row. " +
  'Dates like 9/1/2026. Own guardian Y or N. Service codes separated by ";".';

function exampleCells(agency: ClientImportAgency): string[] {
  const ex = clientTemplateExample(agency);
  return CLIENT_IMPORT_COLUMNS.map((c) => ex[c.key]);
}

export function buildClientTemplateCsv(agency: ClientImportAgency): string {
  return templateCsv(CLIENT_IMPORT_HEADERS, exampleCells(agency), [CLIENT_TEMPLATE_CSV_NOTE]);
}

const col = (key: ClientImportColumn) => CLIENT_IMPORT_COLUMNS.findIndex((c) => c.key === key);

export async function buildClientTemplateXlsx(agency: ClientImportAgency): Promise<Uint8Array> {
  const homes = agency.homes.map((h) => h.name);
  const lists: string[][] = [["Homes", "Own guardian"]];
  for (let i = 0; i < Math.max(homes.length, 2); i += 1)
    lists.push([homes[i] ?? "", ["Y", "N"][i] ?? ""]);
  return buildXlsxTemplate({
    sheetName: "Clients",
    headers: CLIENT_IMPORT_HEADERS,
    example: exampleCells(agency),
    notes: CLIENT_IMPORT_COLUMNS.map((c) => [c.label, CLIENT_TEMPLATE_NOTES[c.key]] as const),
    lists,
    maxRows: IMPORT_MAX_ROWS,
    dropdowns: [
      { column: col("home"), listColumn: "A", count: homes.length, title: "Home" },
      { column: col("own_guardian"), listColumn: "B", count: 2, title: "Own guardian" },
    ],
  });
}

export function downloadClientTemplateCsv(agency: ClientImportAgency): void {
  downloadCsv(buildClientTemplateCsv(agency), "client-import-template.csv");
}

export async function downloadClientTemplateXlsx(agency: ClientImportAgency): Promise<void> {
  downloadXlsx(await buildClientTemplateXlsx(agency), "client-import-template.xlsx");
}
