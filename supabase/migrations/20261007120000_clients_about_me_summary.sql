-- "About <first name>" on the client Profile: the approved Nectar summary of
-- who the person is, one row per client. Each item is a short plain-words
-- bullet with the client document (and page) it came from. A person approves
-- the draft before it is saved (approved_by / approved_at); Nectar never saves
-- on its own. clients.about_me stays as the agency's own notes.
-- Additive only. No ON DELETE actions: client rows are never hard-deleted.

CREATE TABLE IF NOT EXISTS public.client_about_me (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id),
  -- [{ "text": "...", "source_doc_id": "<client_documents.id>", "source_page": 3 }]
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  drafted_by_nectar boolean NOT NULL DEFAULT true,
  approved_by uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  -- The client documents the approved summary was drafted from.
  based_on_doc_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_about_me_org_idx
  ON public.client_about_me (organization_id);

ALTER TABLE public.client_about_me ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read client about me" ON public.client_about_me
  FOR SELECT TO authenticated
  USING (
    access_can_see_client(client_id, auth.uid())
    OR (is_org_member(organization_id, auth.uid()) AND can_access_client_phi(client_id))
  );

CREATE POLICY "clients editors insert client about me" ON public.client_about_me
  FOR INSERT TO authenticated
  WITH CHECK (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND access_can_see_client(client_id, auth.uid())
  );

CREATE POLICY "clients editors update client about me" ON public.client_about_me
  FOR UPDATE TO authenticated
  USING (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND access_can_see_client(client_id, auth.uid())
  )
  WITH CHECK (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND access_can_see_client(client_id, auth.uid())
  );

GRANT SELECT, INSERT, UPDATE ON public.client_about_me TO authenticated;
