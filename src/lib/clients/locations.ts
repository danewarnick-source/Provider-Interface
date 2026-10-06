// Extra service locations (client_approved_locations): places other than the
// home where staff may clock in for this client (day program, job site).
// The punch pad matches live GPS against each active row's geofence. Rows
// are ended (archived_at), never deleted. Pure — importable by node --test.

export const LOCATION_RADIUS_MIN_FEET = 100;
export const LOCATION_RADIUS_MAX_FEET = 5000;
export const LOCATION_RADIUS_DEFAULT_FEET = 500;

export const APPROVED_LOCATION_COLUMNS =
  "id, client_id, label, address, latitude, longitude, geofence_radius_feet, archived_at, created_at";

export type ApprovedLocation = {
  id: string;
  client_id: string;
  label: string;
  address: string | null;
  latitude: number;
  longitude: number;
  geofence_radius_feet: number;
  archived_at: string | null;
  created_at: string;
};

export type LocationDraft = { label: string; address: string; radiusFeet: number };

/** Trimmed, range-checked fields, or the plain-English problem. */
export function cleanLocationDraft(
  d: Partial<LocationDraft>,
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
  return { ok: true, value: { label, address, radiusFeet: radius } };
}

/** Active (not ended) locations, by name. */
export function activeLocations<T extends Pick<ApprovedLocation, "archived_at" | "label">>(
  rows: readonly T[],
): T[] {
  return rows.filter((r) => !r.archived_at).sort((a, b) => a.label.localeCompare(b.label));
}

/** "Day program · 500 ft" */
export function locationSummary(
  l: Pick<ApprovedLocation, "label" | "geofence_radius_feet">,
): string {
  return `${l.label} · ${l.geofence_radius_feet} ft`;
}
