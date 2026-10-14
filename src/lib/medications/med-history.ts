// Plain-English lines for a client_medication_changes row's field diff
// ("Dose: 1 tablet → 2 tablets"). Pure; safe for browser and server.

import { howTakenLabel } from "./med-rules.ts";
import { formatTime12 } from "./med-display.ts";
import { medicationFileLabel } from "./med-files.ts";

const LABELS: Record<string, string> = {
  medication_name: "Name",
  strength: "Strength",
  dose_form: "Dose form",
  dosage: "Dose",
  route: "Route",
  scheduled_times: "Times",
  instructions: "How to give it",
  start_date: "Start date",
  end_date: "Stop date",
  prescriber: "Prescriber",
  pharmacy: "Pharmacy",
  rx_number: "Rx number",
  purpose: "What it's for",
  side_effects: "Common side effects",
  adverse_effects: "Signs of a bad reaction",
  choking_risk: "Swallowing or choking risk",
  packaging: "Packaging",
  packaging_approval_path: "Packaging approval",
  label_photo_path: "Label photo",
  reference_key: "Built-in list entry",
  how_taken: "How they take it",
  is_prn: "As needed (PRN)",
  prn_instructions: "When to give it",
  prn_min_hours: "Minimum hours between doses",
  prn_max_per_day: "Most doses in 24 hours",
  prn_followup_minutes: "Check it worked after (minutes)",
  prn_try_first: "What to try first",
  prn_call_if: "Call the nurse or prescriber if",
  is_rescue: "Rescue medication",
  is_controlled: "Controlled substance",
  controlled_schedule: "Controlled schedule",
  pill_count_current: "Count on hand",
  is_psychotropic: "Psychotropic",
  psychotropic_type: "Psychotropic type",
  diagnosis: "What it treats",
  used_for_behavior: "Used to manage behavior",
  bsp_document_id: "Behavior support plan",
  hrc_restriction_id: "Rights restriction",
  consent_date: "Consent date",
  consent_document_path: "Consent document",
  next_review_date: "Next prescriber review",
  paused_at: "Paused",
  pause_reason: "Pause reason",
  is_active: "Active",
  discontinued_at: "Stopped",
  discontinued_by: "Stopped by",
  stop_reason: "Stop reason",
  sent_to: "Sent to",
  quantity: "How many",
  received_by: "Received by",
};

/** Fields whose value is an id or timestamp: say "set"/"cleared", not the raw value. */
const OPAQUE = new Set([
  "bsp_document_id",
  "hrc_restriction_id",
  "discontinued_by",
  "reference_key",
]);
const FILES = new Set(["packaging_approval_path", "label_photo_path", "consent_document_path"]);
const STAMPS = new Set(["paused_at", "discontinued_at"]);

function show(field: string, v: unknown): string {
  if (v == null || v === "") return "none";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (field === "how_taken") return howTakenLabel(String(v));
  if (field === "scheduled_times" && Array.isArray(v))
    return v.length ? v.map((t) => formatTime12(String(t))).join(", ") : "none";
  if (FILES.has(field)) return medicationFileLabel(String(v));
  if (STAMPS.has(field)) return String(v).slice(0, 10);
  return Array.isArray(v) ? v.join(", ") : String(v);
}

export function describeChanges(changes: unknown): string[] {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return [];
  const out: string[] = [];
  for (const [field, diff] of Object.entries(changes as Record<string, unknown>)) {
    const d = (diff ?? {}) as { from?: unknown; to?: unknown };
    const label = LABELS[field] ?? field.replace(/_/g, " ");
    if (OPAQUE.has(field)) {
      out.push(`${label}: ${d.to == null ? "cleared" : d.from == null ? "set" : "changed"}`);
      continue;
    }
    if (d.from == null || d.from === "") out.push(`${label}: ${show(field, d.to)}`);
    else out.push(`${label}: ${show(field, d.from)} → ${show(field, d.to)}`);
  }
  return out;
}
