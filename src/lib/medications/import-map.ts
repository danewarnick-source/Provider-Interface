// Client import → medication fields: how the person takes each medication
// (from the document's per-medication support level) and its times (from
// scheduled_time / scheduled_times, with am_pm reading 12-hour times).
// Times are only ever read from the document, never made up. Pure.

import { howTakenFromSupportLevel, type HowTaken } from "./med-rules.ts";

/** A document's support level wording → how_taken; null when it doesn't say. */
export function howTakenFromImport(level: unknown): HowTaken | null {
  if (typeof level !== "string") return null;
  const v = level
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!v) return null;
  const legacy = howTakenFromSupportLevel(v);
  if (legacy) return legacy;
  if (["independent", "self_administer", "self_administers", "on_their_own"].includes(v))
    return "self";
  if (
    ["reminder", "prompt", "set_up", "setup", "full_assist", "assist", "staff_assist"].includes(v)
  )
    return "assist";
  if (["nurse", "nurse_administered", "nursing"].includes(v)) return "nurse";
  return null;
}

type Half = "am" | "pm" | "both" | null;

function half(amPm: unknown): Half {
  if (typeof amPm !== "string") return null;
  const v = amPm.trim().toLowerCase();
  if (v === "am") return "am";
  if (v === "pm") return "pm";
  if (v === "both" || v === "am/pm" || v === "am & pm" || v === "am and pm") return "both";
  return null;
}

function hhmm(h: number, m: number) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Times written in one value ("8:00 PM", "08:00, 20:00", "8am") → 24-hour, honoring am_pm. */
function timesFromText(raw: string, amPm: Half): string[] {
  const out: string[] = [];
  const re = /\b(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)?(?![\d])/gi;
  for (const match of raw.matchAll(re)) {
    const h = Number(match[1]);
    const m = Number(match[2] ?? 0);
    const marker = match[3]?.toLowerCase().startsWith("p") ? "pm" : match[3] ? "am" : null;
    if (!match[2] && !marker) continue; // a bare number isn't a time
    if (h > 23) continue;
    if (marker || (h >= 1 && h <= 12 && amPm)) {
      if (h < 1 || h > 12) continue;
      const which = marker ?? amPm;
      const base = h % 12;
      if (which === "am" || which === "both") out.push(hhmm(base, m));
      if (which === "pm" || which === "both") out.push(hhmm(base + 12, m));
    } else {
      out.push(hhmm(h, m));
    }
  }
  return out;
}

/** scheduled_times from an imported medication row. */
export function scheduledTimesFromImport(row: {
  scheduled_time?: unknown;
  scheduled_times?: unknown;
  schedule?: unknown;
  am_pm?: unknown;
}): string[] {
  const amPm = half(row.am_pm);
  const sources: string[] = [];
  if (Array.isArray(row.scheduled_times)) sources.push(...row.scheduled_times.map(String));
  if (!sources.length && typeof row.scheduled_time === "string") sources.push(row.scheduled_time);
  if (!sources.length && typeof row.schedule === "string") sources.push(row.schedule);
  const all = sources.flatMap((s) => timesFromText(s, amPm));
  return [...new Set(all)].sort();
}
