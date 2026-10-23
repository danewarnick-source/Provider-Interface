-- What the agency does (and doesn't do) for one client, answered in the
-- optional "Finish setting up" steps after Add client. Cards that don't apply
-- (medications when the agency doesn't help with them, health events when
-- family handles doctor visits, ...) are hidden on the profile and never count
-- in Needs attention. A null answer means "not asked yet": the card shows.
-- setup_started_at is set when the client is added; the profile shows the
-- "Finish setting up" banner until setup_finished_at is set. Clients added
-- before this table have no row and no banner.
-- Additive only. No ON DELETE actions: client rows are never hard-deleted.

CREATE TABLE IF NOT EXISTS public.client_support_scope (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  helps_with_medications boolean,
  helps_with_appointments boolean,
  has_advance_directive boolean,
  has_bsp boolean,
  no_photo boolean,
  setup_started_at timestamptz,
  setup_finished_at timestamptz,
  answered_by uuid,
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_support_scope_org_idx
  ON public.client_support_scope (organization_id);

ALTER TABLE public.client_support_scope ENABLE ROW LEVEL SECURITY;

-- Same policies as client_about_me.
CREATE POLICY "read client support scope" ON public.client_support_scope
  FOR SELECT TO authenticated
  USING (
    access_can_see_client(client_id, auth.uid())
    OR (is_org_member(organization_id, auth.uid()) AND can_access_client_phi(client_id))
  );

CREATE POLICY "clients editors insert client support scope" ON public.client_support_scope
  FOR INSERT TO authenticated
  WITH CHECK (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND access_can_see_client(client_id, auth.uid())
  );

CREATE POLICY "clients editors update client support scope" ON public.client_support_scope
  FOR UPDATE TO authenticated
  USING (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND access_can_see_client(client_id, auth.uid())
  )
  WITH CHECK (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND access_can_see_client(client_id, auth.uid())
  );

GRANT SELECT, INSERT, UPDATE ON public.client_support_scope TO authenticated;
