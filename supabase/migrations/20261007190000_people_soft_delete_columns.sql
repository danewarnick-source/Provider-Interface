-- Delete a client or team member made by mistake, keeping the data.
-- "Delete" only hides: deleted_at / deleted_by / delete_reason are set and the
-- app leaves the person out of lists, pickers, schedules, counts and exports.
-- Nothing is removed from the database (7-year Medicaid retention); Restore
-- clears the three columns. Additive only: production main ignores them.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS delete_reason text;

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS delete_reason text;

-- Settings → Recently deleted reads only the deleted rows of one agency.
CREATE INDEX IF NOT EXISTS clients_deleted_idx
  ON public.clients (organization_id, deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS organization_members_deleted_idx
  ON public.organization_members (organization_id, deleted_at DESC) WHERE deleted_at IS NOT NULL;
