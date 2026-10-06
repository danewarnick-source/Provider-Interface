// Pure rules for client writes: which access action a change needs, which
// client tables may be written through writeClientRecord, and the "did a row
// actually change" check. No Supabase — importable by node --test.

import { NO_PERMISSION_MESSAGE, type ManageClientAction } from "./guards.ts";

/** clients columns that are medical info (need Client medical: Edit to change). */
export const MEDICAL_CLIENT_FIELDS: ReadonlySet<string> = new Set([
  "allergies",
  "dysphagia",
  "swallowing_alerts",
  "self_admin_med_support",
  "self_admin_med_support_locked",
  "insurance",
  "advanced_directives",
  "emergency_medical_treatment_authorization",
  "diagnoses",
  "chronic_conditions",
  "immunizations",
  "dnr_status",
  "dnr_location",
  "advance_directive_notes",
  "dnr_applicable",
  "polst_status",
  "palliative_care_status",
  "hospice_status",
  "has_abi",
  "height_inches",
  "weight_pounds",
]);

/** clients columns no caller may set through a patch. */
export const LOCKED_CLIENT_FIELDS: ReadonlySet<string> = new Set([
  "id",
  "organization_id",
  "created_at",
]);

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Keys of `patch` whose value differs from `before`. */
export function changedClientFields(
  before: Record<string, unknown> | null,
  patch: Record<string, unknown>,
): string[] {
  return Object.keys(patch).filter((k) => !before || !sameValue(before[k], patch[k]));
}

/**
 * The guard actions a clients-row patch needs. Only fields that really change
 * count, so re-saving a form with unchanged medical fields still only needs
 * Clients: Edit.
 */
export function actionsForClientPatch(
  before: Record<string, unknown> | null,
  patch: Record<string, unknown>,
): ManageClientAction[] {
  const locked = Object.keys(patch).filter((k) => LOCKED_CLIENT_FIELDS.has(k));
  if (locked.length) throw new Error(`These fields can't be changed: ${locked.join(", ")}`);
  const actions = new Set<ManageClientAction>(["edit"]);
  for (const k of changedClientFields(before, patch)) {
    if (MEDICAL_CLIENT_FIELDS.has(k)) actions.add("edit_medical");
    if (k === "account_status" || k === "discharge_date") actions.add("discharge");
  }
  return [...actions];
}

/** No "delete": client records are ended or archived, never deleted. */
export type ClientRecordOp = "insert" | "update" | "upsert";

/**
 * How a table's rows tie back to a client:
 *  - "client": the row has organization_id + client_id.
 *  - "org": the row has organization_id only (org-level HRC / PBA audit work).
 *  - parent: the row points at a parent table that has organization_id + client_id.
 */
export type ClientRecordKey = "client" | "org" | { parent: string; fk: string };

export interface ClientRecordTable {
  action: ManageClientAction;
  ops: readonly ClientRecordOp[];
  key: ClientRecordKey;
  /** false when the table has no organization_id column. */
  hasOrgColumn: boolean;
}

export const CLIENT_RECORD_TABLES = {
  client_documents: {
    action: "edit",
    ops: ["insert", "update"],
    key: "client",
    hasOrgColumn: true,
  },
  client_progress_summaries: { action: "edit", ops: ["insert"], key: "client", hasOrgColumn: true },
  client_health_events: {
    action: "edit_medical",
    ops: ["insert", "update"],
    key: "client",
    hasOrgColumn: true,
  },
  client_absences: { action: "edit_medical", ops: ["insert", "update"], key: "client", hasOrgColumn: true },
  sjd_assessment_selections: { action: "edit", ops: ["upsert"], key: "client", hasOrgColumn: true },
  hrc_restriction_records: {
    action: "edit_hrc",
    ops: ["insert", "update"],
    key: "client",
    hasOrgColumn: true,
  },
  hrc_reviews: { action: "edit_hrc", ops: ["insert"], key: "org", hasOrgColumn: true },
  hrc_meetings: { action: "edit_hrc", ops: ["insert"], key: "org", hasOrgColumn: true },
  client_billing_codes: {
    action: "edit_billing",
    ops: ["insert", "update", "upsert"],
    key: "client",
    hasOrgColumn: true,
  },
  client_budgets: {
    action: "edit_funds",
    ops: ["insert", "update"],
    key: "client",
    hasOrgColumn: true,
  },
  client_budget_lines: {
    action: "edit_funds",
    ops: ["insert", "update"],
    key: { parent: "client_budgets", fk: "budget_id" },
    hasOrgColumn: false,
  },
  pba_accounts: { action: "edit_funds", ops: ["insert"], key: "client", hasOrgColumn: true },
  pba_transactions: {
    action: "edit_funds",
    ops: ["insert"],
    key: { parent: "pba_accounts", fk: "account_id" },
    hasOrgColumn: true,
  },
  pba_audit_samples: { action: "edit_funds", ops: ["update"], key: "org", hasOrgColumn: true },
} as const satisfies Record<string, ClientRecordTable>;

export type ClientRecordTableName = keyof typeof CLIENT_RECORD_TABLES;
export const CLIENT_RECORD_TABLE_NAMES = Object.keys(
  CLIENT_RECORD_TABLES,
) as ClientRecordTableName[];

export function tableConfig(table: string, op: ClientRecordOp): ClientRecordTable {
  const cfg = (CLIENT_RECORD_TABLES as Record<string, ClientRecordTable>)[table];
  if (!cfg) throw new Error(`Unknown client table: ${table}`);
  if (!cfg.ops.includes(op)) throw new Error(`${op} is not allowed on ${table}`);
  return cfg;
}

/**
 * Rows to insert/upsert with the scoping columns forced from the request, so a
 * caller can never write into another organization or client.
 */
export function stampRows(
  cfg: ClientRecordTable,
  rows: Record<string, unknown>[],
  organizationId: string,
  clientId: string | null,
): Record<string, unknown>[] {
  return rows.map((r) => {
    const out: Record<string, unknown> = { ...r };
    if (cfg.hasOrgColumn) out.organization_id = organizationId;
    if (cfg.key === "client") {
      if (!clientId) throw new Error("A client is required for this change");
      out.client_id = clientId;
    }
    return out;
  });
}

/** Update values with the scoping columns removed (they can't be moved). */
export function stripScopeColumns(values: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, organization_id: _org, client_id: _client, ...rest } = values;
  return rest;
}

/** Throws the plain-English permission error when RLS (or a filter) let nothing change. */
export function assertRowsChanged<T>(rows: T[] | null | undefined): T[] {
  if (!rows || rows.length === 0) throw new Error(NO_PERMISSION_MESSAGE);
  return rows;
}
