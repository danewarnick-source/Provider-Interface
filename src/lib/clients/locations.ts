// Extra service locations (client_approved_locations): places other than the
// home where staff may clock in for this client (day program, job site).
// The punch pad matches live GPS against each active row's geofence, so every
// row needs a pin (geocoded, or dropped by the admin when geocoding fails).
// Each needs a reason when added or edited. Rows are ended (archived_at),
// never deleted. Pure — importable by node --test.

export const LOCATION_RADIUS_MIN_FEET = 100;
export const LOCATION_RADIUS_MAX_FEET = 5000;
export const LOCATION_RADIUS_DEFAULT_FEET = 500;

export const APPROVED_LOCATION_COLUMNS =
  "id, client_id, label, address, latitude, longitude, geofence_radius_feet, reason, reason_note, archived_at, created_at";

export const LOCATION_REASONS = [
  { value: "day_program", label: "Day program" },
  { value: "job_site", label: "Job site" },
  { value: "family_home", label: "Family home" },
  { value: "respite", label: "Respite" },
  { value: "school", label: "School" },
  { value: "medical", label: "Medical" },
  { value: "other", label: "Other" },
] as const;

export type LocationReason = (typeof LOCATION_REASONS)[number]["value"];

export const LOCATION_REASON_NOTE_MAX = 200;

/** The server's answer when the address can't be geocoded: the dialog then asks for a pin. */
export const LOCATION_NEEDS_PIN =
  "We couldn't find that address on the map. Drop a pin where staff clock in, then save.";

export type ApprovedLocation = {
  id: string;
  client_id: string;
  label: string;
  address: string | null;
  latitude: number;
  longitude: number;
  geofence_radius_feet: number;
  reason: string | null;
  reason_note: string | null;
  archived_at: string | null;
  created_at: string;
};

export type LocationPin = { lat: number; lng: number };

export type LocationDraft = {
  label: string;
  address: string;
  radiusFeet: number;
  reason: LocationReason;
  /** Only for "other"; null otherwise. */
  reasonNote: string | null;
  /** An admin-dropped pin; without one the server geocodes the address. */
  pin: LocationPin | null;
};

export type LocationDraftInput = Partial<Omit<LocationDraft, "reason">> & { reason?: string | null };

const isReason = (v: unknown): v is LocationReason =>
  LOCATION_REASONS.some((r) => r.value === v);

export function isValidPin(p: unknown): p is LocationPin {
  const pin = p as LocationPin | null;
  return (
    !!pin &&
    Number.isFinite(pin.lat) &&
    Number.isFinite(pin.lng) &&
    Math.abs(pin.lat) <= 90 &&
    Math.abs(pin.lng) <= 180 &&
    !(pin.lat === 0 && pin.lng === 0)
  );
}

/** Trimmed, range-checked fields, or the plain-English problem. */
export function cleanLocationDraft(
  d: LocationDraftInput,
): { ok: true; value: LocationDraft } | { ok: false; error: string } {
  const label = (d.label ?? "").trim();
  const address = (d.address ?? "").trim();
  const radius = Math.round(Number(d.radiusFeet ?? LOCATION_RADIUS_DEFAULT_FEET));
  if (!label) return { ok: false, error: "Give the location a name" };
  if (label.length > 120) return { ok: false, error: "The name is too long" };
  if (!address) return { ok: false, error: "Enter the street address" };
  if (
    !Number.isFinite(radius) ||
    radius < LOCATION_RADIUS_MIN_FEET ||
    radius > LOCATION_RADIUS_MAX_FEET
  ) {
    return {
      ok: false,
      error: `Clock-in distance must be ${LOCATION_RADIUS_MIN_FEET}–${LOCATION_RADIUS_MAX_FEET} feet`,
    };
  }
  if (!isReason(d.reason)) return { ok: false, error: "Choose a reason for this location" };
  const note = (d.reasonNote ?? "").trim();
  if (d.reason === "other" && !note) return { ok: false, error: "Add a short note for Other" };
  if (note.length > LOCATION_REASON_NOTE_MAX) return { ok: false, error: "The note is too long" };
  if (d.pin != null && !isValidPin(d.pin)) return { ok: false, error: "Drop the pin on the map again" };
  return {
    ok: true,
    value: {
      label,
      address,
      radiusFeet: radius,
      reason: d.reason,
      reasonNote: d.reason === "other" ? note : null,
      pin: d.pin ?? null,
    },
  };
}

/** Active (not ended) locations, by name. */
export function activeLocations<T extends Pick<ApprovedLocation, "archived_at" | "label">>(
  rows: readonly T[],
): T[] {
  return rows.filter((r) => !r.archived_at).sort((a, b) => a.label.localeCompare(b.label));
}

/** "Day program", "Other: grandma's church"; null when no reason was recorded. */
export function locationReasonLabel(
  l: Pick<ApprovedLocation, "reason" | "reason_note">,
): string | null {
  const found = LOCATION_REASONS.find((r) => r.value === l.reason);
  if (!found) return null;
  const note = l.reason_note?.trim();
  return found.value === "other" && note ? `Other: ${note}` : found.label;
}

/** "Day program · 500 ft" */
export function locationSummary(
  l: Pick<ApprovedLocation, "label" | "geofence_radius_feet">,
): string {
  return `${l.label} · ${l.geofence_radius_feet} ft`;
}
