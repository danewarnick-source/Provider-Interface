// The four tiles at the top of the client Health section (Allergies, Diet,
// Mobility, Emergency plan), read from the same clients columns the Health
// cards edit, and the dot tone of each health event type.
// Plain wording only; pure, importable by node --test.

import { directiveLabel, directiveStatus } from "./health.ts";

export type HealthTile = { value: string; note: string | null; warn: boolean };
export type HealthTone = "info" | "ok" | "danger" | "profile" | "neutral";

const first = (items: readonly string[], n: number) =>
  items.length > n ? `${items.slice(0, n).join(", ")} +${items.length - n} more` : items.join(", ");

export function allergyTile(allergies: readonly string[] | null | undefined): HealthTile {
  const list = (allergies ?? []).filter((a) => a.trim());
  if (!list.length) return { value: "None on file", note: null, warn: false };
  return {
    value: `${list.length} allerg${list.length === 1 ? "y" : "ies"}`,
    note: first(list, 3),
    warn: true,
  };
}

export function dietTile(args: {
  dysphagia: boolean | null | undefined;
  swallowingAlerts: readonly string[] | null | undefined;
  diets: readonly string[] | null | undefined;
}): HealthTile {
  const diets = (args.diets ?? []).filter((d) => d.trim());
  const alerts = (args.swallowingAlerts ?? []).filter((a) => a.trim());
  if (args.dysphagia)
    return {
      value: "Trouble swallowing",
      note: alerts.length ? first(alerts, 2) : diets.length ? first(diets, 2) : null,
      warn: true,
    };
  if (!diets.length) return { value: "No special diet on file", note: null, warn: false };
  return { value: "Special diet", note: first(diets, 3), warn: false };
}

export function mobilityTile(mobility: readonly string[] | null | undefined): HealthTile {
  const list = (mobility ?? []).filter((m) => m.trim());
  if (!list.length) return { value: "Not on file", note: null, warn: false };
  return { value: list[0], note: list.length > 1 ? first(list.slice(1), 2) : null, warn: false };
}

/** The emergency plan text (its first line) and the advance directive under it. */
export function emergencyPlanTile(args: {
  plan: string | null | undefined;
  dnrStatus: string | null | undefined;
  polstStatus: string | null | undefined;
}): HealthTile {
  const status = directiveStatus(args.dnrStatus) ?? (args.polstStatus ? "polst" : null);
  const directive = status === "dnr" || status === "polst" ? `${directiveLabel(status)} on file` : null;
  const line = (args.plan ?? "").split(/\r?\n/).find((l) => l.trim())?.trim() ?? null;
  if (!line) return { value: "No plan written", note: directive, warn: true };
  const value = line.length > 60 ? `${line.slice(0, 59)}…` : line;
  return { value, note: directive, warn: !!directive };
}

/** Dot color per health event type on the timeline. */
export function healthEventTone(type: string): HealthTone {
  switch (type) {
    case "exam":
      return "info";
    case "immunization":
      return "ok";
    case "health_change":
      return "profile";
    case "injury":
    case "surgery":
    case "hospital":
      return "danger";
    default:
      return "neutral";
  }
}
