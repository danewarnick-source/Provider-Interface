// The four tiles at the top of the client Health section (Allergies, Diet,
// Mobility, Emergency plan) and the dot tone of each health event type.
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
  diet: string | null | undefined;
}): HealthTile {
  const diet = args.diet?.trim() || null;
  const alerts = (args.swallowingAlerts ?? []).filter((a) => a.trim());
  if (args.dysphagia)
    return {
      value: "Trouble swallowing",
      note: alerts.length ? first(alerts, 2) : diet,
      warn: true,
    };
  return { value: diet ? "Special diet" : "No special diet on file", note: diet, warn: false };
}

export function mobilityTile(args: {
  mobility: string | null | undefined;
  equipment: string | null | undefined;
}): HealthTile {
  const mobility = args.mobility?.trim() || null;
  const equipment = args.equipment?.trim() || null;
  if (!mobility && !equipment) return { value: "Not on file", note: null, warn: false };
  return {
    value: mobility ?? "See equipment",
    note: equipment ? `Equipment: ${equipment}` : null,
    warn: false,
  };
}

export function emergencyPlanTile(args: {
  dnrStatus: string | null | undefined;
  polstStatus: string | null | undefined;
  treatmentAuthorization: boolean | null | undefined;
}): HealthTile {
  const status = directiveStatus(args.dnrStatus) ?? (args.polstStatus ? "polst" : null);
  const treatment = args.treatmentAuthorization
    ? "Emergency treatment authorization signed"
    : "No emergency treatment authorization";
  if (status === "dnr" || status === "polst")
    return { value: `${directiveLabel(status)} on file`, note: treatment, warn: true };
  return {
    value: status === "none" ? "No advance directive" : "Advance directive not set",
    note: treatment,
    warn: !args.treatmentAuthorization,
  };
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
