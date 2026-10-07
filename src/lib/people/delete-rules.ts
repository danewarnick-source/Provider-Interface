// Pure rules for deleting a client or team member made by mistake. "Delete"
// only hides the person (deleted_at); nothing is removed. No Supabase here so
// node --test can import it; delete.functions.ts wires the real data.

import { hasCategory } from "../access/can.ts";
import type { CategoryId, CategoryValue } from "../access/categories.ts";

export type PersonKind = "client" | "member";

/** Service records that make a person real. Keys match SQL person_service_history(). */
export const HISTORY_KEYS = [
  "shifts",
  "punches",
  "notes",
  "daily_logs",
  "med_passes",
  "billing",
  "signed_documents",
  "summaries",
] as const;
export type HistoryKey = (typeof HISTORY_KEYS)[number];
export type ServiceHistory = Record<HistoryKey, number>;

const HISTORY_LABEL: Record<HistoryKey, [string, string]> = {
  shifts: ["shift", "shifts"],
  punches: ["punch", "punches"],
  notes: ["note", "notes"],
  daily_logs: ["daily log", "daily logs"],
  med_passes: ["med pass", "med passes"],
  billing: ["billing record", "billing records"],
  signed_documents: ["signed document", "signed documents"],
  summaries: ["summary", "summaries"],
};

export const DELETE_REASONS = ["Created by mistake", "Duplicate"] as const;

/** Reads the RPC's jsonb; anything missing or unreadable counts as history (fails closed). */
export function parseHistory(raw: unknown): ServiceHistory {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = {} as ServiceHistory;
  for (const key of HISTORY_KEYS) {
    const n = Number(src[key]);
    out[key] = Number.isFinite(n) && n >= 0 ? n : 1;
  }
  return out;
}

export function hasServiceHistory(history: ServiceHistory): boolean {
  return HISTORY_KEYS.some((k) => history[k] > 0);
}

/** "3 shifts, 1 daily log" — only the kinds that exist. */
export function historySummary(history: ServiceHistory): string {
  return HISTORY_KEYS.filter((k) => history[k] > 0)
    .map((k) => `${history[k]} ${HISTORY_LABEL[k][history[k] === 1 ? 0 : 1]}`)
    .join(", ");
}

/** Why Delete isn't offered, pointing to the action that ends services instead. */
export function historyBlockedMessage(kind: PersonKind, name: string): string {
  return kind === "client"
    ? `${name} has service records, so they can't be deleted. Use Discharge to end services; their records stay on file.`
    : `${name} has service records, so they can't be deleted. Use Deactivate to end their employment; their records stay on file.`;
}

/** Owners always; anyone else only with "Delete people" turned on. */
export function canDeletePeople(categories: Record<CategoryId, CategoryValue>): boolean {
  return hasCategory(categories, "delete_people", "edit");
}

function normalizeName(s: string): string {
  return s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

/** The typed confirmation matches the full name (case and extra spaces ignored). */
export function nameConfirmed(typed: string, fullName: string): boolean {
  const want = normalizeName(fullName);
  return want.length > 0 && normalizeName(typed) === want;
}

/** The reason saved with the delete: a chip, or the "Other" text. Null when missing. */
export function deleteReasonText(choice: string, other: string): string | null {
  if ((DELETE_REASONS as readonly string[]).includes(choice)) return choice;
  const text = other.trim();
  return choice === "other" && text ? text : null;
}
