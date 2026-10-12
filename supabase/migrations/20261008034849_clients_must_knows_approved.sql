-- Must-knows on the client Overview: provenance of the approved Nectar draft.
-- clients.special_directions stays the one text every reader uses (face
-- sheet, quick-info sheet, shift page, Nectar answers, eMAR, incidents); on
-- approval it is replaced by approved_text (headings + "- " bullets). This
-- table keeps where each bullet came from and who approved it and when.
-- A person approves before anything is saved; Nectar never saves on its own.
-- Additive only. No ON DELETE actions: client rows are never hard-deleted.

CREATE TABLE IF NOT EXISTS public.client_must_knows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id),
  -- [{ "section": "health", "text": "...", "source_doc_id": "<client_documents.id>" | null, "source_page": 3 }]
  -- source_doc_id null = taken from the must-knows text that was there before.
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  -- Exactly what was written to clients.special_directions on approval.
  approved_text text NOT NULL,
  drafted_by_nectar boolean NOT NULL DEFAULT true,
  approved_by uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  based_on_doc_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_must_knows_org_idx
  ON public.client_must_knows (organization_id);

ALTER TABLE public.client_must_knows ENABLE ROW LEVEL SECURITY;

-- Same policies as client_about_me.
CREATE POLICY "read client must knows" ON public.client_must_knows
  FOR SELECT TO authenticated
  USING (
    access_can_see_client(client_id, auth.uid())
    OR (is_org_member(organization_id, auth.uid()) AND can_access_client_phi(client_id))
  );

CREATE POLICY "clients editors insert client must knows" ON public.client_must_knows
  FOR INSERT TO authenticated
  WITH CHECK (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND access_can_see_client(client_id, auth.uid())
  );

CREATE POLICY "clients editors update client must knows" ON public.client_must_knows
  FOR UPDATE TO authenticated
  USING (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND access_can_see_client(client_id, auth.uid())
  )
  WITH CHECK (
    access_has_category(organization_id, auth.uid(), 'clients', 'edit')
    AND access_can_see_client(client_id, auth.uid())
  );

GRANT SELECT, INSERT, UPDATE ON public.client_must_knows TO authenticated;
