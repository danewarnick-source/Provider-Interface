// How a medication reads on the client's Medications tab and the printed
// list: times in 12-hour form, sort order, badges, status and the "how they
// take it" summary. Pure; safe for browser and server.

import { ORIGINAL_BOTTLE, type HowTaken } from "./med-rules.ts";

/** The medication fields this file reads (client_medications names). */
export interface DisplayMed {
  medication_name?: string | null;
  strength?: string | null;
  dosage?: string | null;
  scheduled_times?: string[] | null;
  is_prn?: boolean | null;
  is_rescue?: boolean | null;
  is_psychotropic?: boolean | null;
  is_controlled?: boolean | null;
  controlled_schedule?: string | null;
  choking_risk?: boolean | null;
  contributes_to_swallowing_difficulty?: boolean | null;
  packaging?: string | null;
  how_taken?: HowTaken | string | null;
  is_active?: boolean | null;
  discontinued_at?: string | null;
  paused_at?: string | null;
  stop_reason?: string | null;
  pause_reason?: string | null;
}

/** Packaging choices on the form. Older rows may hold other wording. */
export const DOSE_PACK = "dose pack";
export const PACKAGING_OPTIONS = [
  { value: DOSE_PACK, label: "Pharmacy dose pack" },
  { value: ORIGINAL_BOTTLE, label: "Original bottle" },
] as const;

function parseHm(raw: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** "20:00" → "8:00 PM". Unreadable values come back as typed. */
export function formatTime12(raw: string): string {
  const total = parseHm(raw);
  if (total == null) return raw;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Valid times, earliest first, no repeats. */
export function sortedTimes(times: readonly string[] | null | undefined): string[] {
  const seen = new Map<number, string>();
  for (const t of times ?? []) {
    const total = parseHm(t);
    if (total == null || seen.has(total)) continue;
    seen.set(
      total,
      `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`,
    );
  }
  return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

/** "8:00 AM, 8:00 PM", or "As needed" for a PRN. */
export function whenGivenLabel(med: DisplayMed): string {
  if (med.is_prn) return "As needed";
  const times = sortedTimes(med.scheduled_times);
  return times.length ? times.map(formatTime12).join(", ") : "No times set";
}

/** "Sertraline 50 mg" (strength, else dose). */
export function nameWithStrength(med: DisplayMed): string {
  const name = (med.medication_name ?? "").trim();
  const amount = (med.strength ?? "").trim() || (med.dosage ?? "").trim();
  return amount ? `${name} ${amount}` : name;
}

/** Minutes after midnight of the first dose; PRNs and untimed meds sort last. */
function firstMinute(med: DisplayMed): number {
  if (med.is_prn) return Number.POSITIVE_INFINITY;
  const first = sortedTimes(med.scheduled_times)[0];
  return first ? (parseHm(first) ?? 1440) : 1440;
}

/** Sorted by first time of day, PRNs last, then by name. */
export function sortMedications<T extends DisplayMed>(meds: readonly T[]): T[] {
  return [...meds].sort(
    (a, b) =>
      firstMinute(a) - firstMinute(b) ||
      (a.medication_name ?? "").localeCompare(b.medication_name ?? ""),
  );
}

export type MedStatus = "active" | "paused" | "stopped";

export function medStatus(med: DisplayMed): MedStatus {
  if (med.is_active === false || med.discontinued_at) return "stopped";
  if (med.paused_at) return "paused";
  return "active";
}

/** Active meds for the main list; paused and stopped ones for "Show stopped". */
export function splitByStatus<T extends DisplayMed>(meds: readonly T[]) {
  const active: T[] = [];
  const inactive: T[] = [];
  for (const m of meds) (medStatus(m) === "active" ? active : inactive).push(m);
  return { active: sortMedications(active), inactive: sortMedications(inactive) };
}

/** "Stopped: side effects" / "Paused: in hospital". */
export function statusReason(med: DisplayMed): string | null {
  const status = medStatus(med);
  if (status === "stopped") return `Stopped${med.stop_reason ? `: ${med.stop_reason}` : ""}`;
  if (status === "paused") return `Paused${med.pause_reason ? `: ${med.pause_reason}` : ""}`;
  return null;
}

export type MedBadge = { key: string; label: string; tone: "info" | "warn" | "danger" };

export function medicationBadges(med: DisplayMed): MedBadge[] {
  const out: MedBadge[] = [];
  if (med.is_prn) out.push({ key: "prn", label: "PRN", tone: "info" });
  if (med.is_rescue) out.push({ key: "rescue", label: "Rescue", tone: "danger" });
  if (med.is_psychotropic) out.push({ key: "psych", label: "Psychotropic", tone: "info" });
  if (med.is_controlled) {
    const s = (med.controlled_schedule ?? "").trim();
    out.push({ key: "controlled", label: s ? `C-${s}` : "Controlled", tone: "warn" });
  }
  if (med.choking_risk || med.contributes_to_swallowing_difficulty)
    out.push({ key: "swallow", label: "Swallowing risk", tone: "danger" });
  if (med.packaging === ORIGINAL_BOTTLE)
    out.push({ key: "packaging", label: "Not dose-packed", tone: "warn" });
  return out;
}

/** "Staff help with 3 · On their own with 1 · Nurse gives 0" over active meds. */
export function howTakenSummary(meds: readonly DisplayMed[]): string {
  const count = { self: 0, assist: 0, nurse: 0 };
  for (const m of meds) {
    if (medStatus(m) === "stopped") continue;
    if (m.how_taken === "self" || m.how_taken === "assist" || m.how_taken === "nurse")
      count[m.how_taken] += 1;
  }
  return `Staff help with ${count.assist} · On their own with ${count.self} · Nurse gives ${count.nurse}`;
}
