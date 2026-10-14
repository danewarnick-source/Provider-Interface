// Medication status changes, "Send with client" and change history, behind
// meds.functions.ts. Callers run assertCanManageClient first and pass the
// service client. Stopping never deletes: it sets discontinued_at.

import {
  loadMedication,
  norm,
  recordChange,
  type ChangeAction,
  type FieldChanges,
  type Sb,
} from "./meds-write.ts";

export async function setMedicationStatusRow(
  sb: Sb,
  a: {
    userId: string;
    id: string;
    action: "pause" | "resume" | "stop";
    reason?: string | null;
    now?: Date;
  },
): Promise<void> {
  const med = await loadMedication(sb, a.id);
  const reason = a.reason?.trim() || null;
  const now = (a.now ?? new Date()).toISOString();
  if (!med.is_active || med.discontinued_at)
    throw new Error("This medication has already been stopped.");
  if ((a.action === "pause" || a.action === "stop") && !reason) throw new Error("Add a reason.");
  let patch: Record<string, unknown>;
  if (a.action === "pause") {
    if (med.paused_at) throw new Error("This medication is already paused.");
    patch = { paused_at: now, pause_reason: reason };
  } else if (a.action === "resume") {
    if (!med.paused_at) throw new Error("This medication isn't paused.");
    patch = { paused_at: null, pause_reason: null };
  } else {
    patch = {
      is_active: false,
      discontinued_at: now,
      discontinued_by: a.userId,
      stop_reason: reason,
    };
  }
  const changes: FieldChanges = {};
  for (const [k, v] of Object.entries(patch)) changes[k] = { from: norm(med[k]), to: v };
  const { error } = await sb.from("client_medications").update(patch).eq("id", med.id);
  if (error) throw new Error(error.message);
  await recordChange(sb, med, a.userId, a.action, changes, reason);
}

export async function sendMedicationRow(
  sb: Sb,
  a: {
    userId: string;
    userName: string;
    id: string;
    to: string;
    quantity: number;
    receivedBy: string;
    note?: string | null;
  },
): Promise<void> {
  const med = await loadMedication(sb, a.id);
  if (!(a.quantity > 0)) throw new Error("Add how many were sent.");
  const { error } = await sb.from("medication_transfers").insert({
    organization_id: med.organization_id,
    client_id: med.client_id,
    medication_id: med.id,
    from_location: "Agency",
    to_location: a.to.trim(),
    quantity: a.quantity,
    released_by_staff_id: a.userId,
    released_by_name: a.userName,
    received_by_name: a.receivedBy.trim(),
    notes: a.note?.trim() || null,
  });
  if (error) throw new Error(error.message);
  await recordChange(
    sb,
    med,
    a.userId,
    "send",
    {
      sent_to: { from: null, to: a.to.trim() },
      quantity: { from: null, to: a.quantity },
      received_by: { from: null, to: a.receivedBy.trim() },
    },
    a.note,
  );
}

export async function listChanges(sb: Sb, medicationId: string) {
  const { data, error } = await sb
    .from("client_medication_changes")
    .select("id, medication_id, changed_by, changed_at, action, changes, reason")
    .eq("medication_id", medicationId)
    .order("changed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string;
    medication_id: string;
    changed_by: string | null;
    changed_at: string;
    action: ChangeAction;
    changes: FieldChanges;
    reason: string | null;
  }>;
}
