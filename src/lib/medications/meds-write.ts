// Medication reads and saves behind meds.functions.ts. Callers run
// assertCanManageClient first and pass the service client. Nothing is
// deleted: stopping sets discontinued_at; every change writes a
// client_medication_changes row with the field diff.

import {
  requiredFieldErrors,
  supportLevelForHowTaken,
  type HowTaken,
  type MedicationFields,
} from "./med-rules.ts";
import { isClientMedicationFile } from "./med-files.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Sb = { from: (table: string) => any };

/** Columns the medication form edits (client_medications names). */
export const EDITABLE_COLUMNS = [
  "medication_name",
  "strength",
  "dose_form",
  "dosage",
  "route",
  "scheduled_times",
  "frequency",
  "instructions",
  "start_date",
  "end_date",
  "prescriber",
  "pharmacy",
  "rx_number",
  "purpose",
  "side_effects",
  "adverse_effects",
  "choking_risk",
  "contributes_to_swallowing_difficulty",
  "packaging",
  "packaging_approval_path",
  "label_photo_path",
  "reference_key",
  "how_taken",
  "is_prn",
  "prn_instructions",
  "prn_min_hours",
  "prn_max_per_day",
  "prn_followup_minutes",
  "prn_try_first",
  "prn_call_if",
  "is_rescue",
  "is_controlled",
  "controlled_schedule",
  "pill_count_current",
  "is_psychotropic",
  "psychotropic_type",
  "diagnosis",
  "used_for_behavior",
  "bsp_document_id",
  "hrc_restriction_id",
  "consent_date",
  "consent_document_path",
  "next_review_date",
] as const;
export type EditableColumn = (typeof EDITABLE_COLUMNS)[number];
export type MedicationInput = Partial<Record<EditableColumn, unknown>> & MedicationFields;

export type MedicationRow = Record<string, unknown> & {
  id: string;
  organization_id: string;
  client_id: string;
  medication_name: string;
  is_active: boolean;
  discontinued_at: string | null;
  paused_at: string | null;
  support_level?: string | null;
};

export type ChangeAction = "add" | "edit" | "pause" | "resume" | "stop" | "send";
export type FieldChanges = Record<string, { from: unknown; to: unknown }>;

export class MedicationValidationError extends Error {
  issues: Array<{ field: string; message: string }>;
  constructor(issues: Array<{ field: string; message: string }>) {
    super(issues.map((i) => i.message).join(" "));
    this.name = "MedicationValidationError";
    this.issues = issues;
  }
}

export const norm = (v: unknown) => (v === undefined || v === "" ? null : v);

/** Field → {from, to} for every editable column that changed. */
export function medicationDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
): FieldChanges {
  const out: FieldChanges = {};
  for (const col of EDITABLE_COLUMNS) {
    if (!(col in after)) continue;
    const from = norm(before?.[col]);
    const to = norm(after[col]);
    if (JSON.stringify(from) !== JSON.stringify(to)) out[col] = { from, to };
  }
  return out;
}

/** Only editable columns, blanks as null. */
export function pickEditable(input: MedicationInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of EDITABLE_COLUMNS) if (col in input) out[col] = norm(input[col]);
  return out;
}

export async function listMedications(
  sb: Sb,
  clientId: string,
  opts: { includeStopped?: boolean } = {},
) {
  let q = sb.from("client_medications").select("*").eq("client_id", clientId);
  if (!opts.includeStopped) q = q.eq("is_active", true);
  const { data, error } = await q.order("medication_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MedicationRow[];
}

export async function loadMedication(sb: Sb, id: string): Promise<MedicationRow> {
  const { data, error } = await sb
    .from("client_medications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Medication not found.");
  return data as MedicationRow;
}

/** The medication's client and agency, for the caller's guard. */
export async function medicationOwner(
  sb: Sb,
  id: string,
): Promise<{ clientId: string; organizationId: string }> {
  const med = await loadMedication(sb, id);
  return { clientId: med.client_id, organizationId: med.organization_id };
}

export async function recordChange(
  sb: Sb,
  med: { organization_id: string; client_id: string; id: string },
  userId: string,
  action: ChangeAction,
  changes: FieldChanges,
  reason?: string | null,
) {
  const { error } = await sb.from("client_medication_changes").insert({
    organization_id: med.organization_id,
    client_id: med.client_id,
    medication_id: med.id,
    changed_by: userId,
    action,
    changes,
    reason: reason?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

/** Legacy columns main still reads, kept in sync until M6. */
function legacySync(
  fields: Record<string, unknown>,
  current: MedicationRow | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ("how_taken" in fields) {
    out.support_level = supportLevelForHowTaken(
      fields.how_taken as HowTaken | null,
      current?.support_level ?? null,
    );
  }
  if ("scheduled_times" in fields) {
    const times = (fields.scheduled_times as string[] | null) ?? [];
    out.scheduled_time = times[0] ?? null;
    out.scheduled_times = times;
  }
  return out;
}

const FILE_COLUMNS = ["packaging_approval_path", "label_photo_path", "consent_document_path"];

/** Uploads must be this client's medication files; linked BSP and HRC records must be this client's. */
async function assertOwnLinks(
  sb: Sb,
  a: { organizationId: string; clientId: string },
  fields: Record<string, unknown>,
  current: MedicationRow | null,
) {
  for (const col of FILE_COLUMNS) {
    const path = fields[col];
    if (path == null || path === current?.[col]) continue;
    if (typeof path !== "string" || !isClientMedicationFile(path, a.organizationId, a.clientId))
      throw new Error("That file isn't one of this client's medication files.");
  }
  const links: Array<[string, string]> = [
    ["bsp_document_id", "client_documents"],
    ["hrc_restriction_id", "hrc_restriction_records"],
  ];
  for (const [col, table] of links) {
    const id = fields[col];
    if (id == null || id === current?.[col]) continue;
    const { data, error } = await sb
      .from(table)
      .select("id")
      .eq("id", id)
      .eq("organization_id", a.organizationId)
      .eq("client_id", a.clientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("That plan or approval isn't on this client's record.");
  }
}

export async function saveMedicationRow(
  sb: Sb,
  a: {
    organizationId: string;
    clientId: string;
    userId: string;
    id?: string | null;
    input: MedicationInput;
  },
): Promise<{ id: string; changes: FieldChanges }> {
  const fields = pickEditable(a.input);
  const current = a.id ? await loadMedication(sb, a.id) : null;
  if (
    current &&
    (current.client_id !== a.clientId || current.organization_id !== a.organizationId)
  ) {
    throw new Error("Medication not found.");
  }
  const merged = { ...(current ?? {}), ...fields } as MedicationFields;
  const issues = requiredFieldErrors(merged);
  if (issues.length)
    throw new MedicationValidationError(
      issues.map((i) => ({ field: String(i.field), message: i.message })),
    );

  await assertOwnLinks(sb, a, fields, current);
  const changes = medicationDiff(current, fields);
  const row = { ...fields, ...legacySync(fields, current) };
  if (!current) {
    const { data, error } = await sb
      .from("client_medications")
      .insert({
        ...row,
        organization_id: a.organizationId,
        client_id: a.clientId,
        created_by: a.userId,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const id = (data as { id: string }).id;
    await recordChange(
      sb,
      { organization_id: a.organizationId, client_id: a.clientId, id },
      a.userId,
      "add",
      changes,
    );
    return { id, changes };
  }
  if (Object.keys(changes).length === 0) return { id: current.id, changes };
  const { error } = await sb.from("client_medications").update(row).eq("id", current.id);
  if (error) throw new Error(error.message);
  await recordChange(sb, current, a.userId, "edit", changes);
  return { id: current.id, changes };
}
