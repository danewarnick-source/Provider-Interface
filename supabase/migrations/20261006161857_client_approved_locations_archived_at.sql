-- Extra service locations (client_approved_locations) are ended, never
-- deleted: EVV rows point at them through matched_approved_location_id.
-- Additive only; production main keeps reading every row until it ships.
ALTER TABLE public.client_approved_locations
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

CREATE INDEX IF NOT EXISTS client_approved_locations_client_active_idx
  ON public.client_approved_locations (client_id)
  WHERE archived_at IS NULL;
