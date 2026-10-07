-- Client file reads Evidence: which Evidence packs each client has, and where
-- each item came from.
--
-- evidence_client_packs: one row per client per pack. origin 'code' = a
-- service code brought it (it follows the code: retired when the code ends,
-- brought back when it returns); 'hand' = an admin added it. A removed pack
-- keeps its row (removed_at / removed_by / removed_reason) and its items stay
-- on record as "Not needed". The agency "has applied" a pack once any client
-- has a row for it.
--
-- evidence_items.added_by_hand: an item added one at a time (not from a
-- pack); it never follows codes. evidence_items.description: the short
-- explanation for a custom item.
--
-- Additive only. No ON DELETE actions: client rows are never hard-deleted.

ALTER TABLE public.evidence_items
  ADD COLUMN IF NOT EXISTS added_by_hand boolean NOT NULL DEFAULT false;

ALTER TABLE public.evidence_items
  ADD COLUMN IF NOT EXISTS description text;

CREATE TABLE IF NOT EXISTS public.evidence_client_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  pack_key text NOT NULL,
  origin text NOT NULL DEFAULT 'hand' CHECK (origin IN ('code', 'hand')),
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid,
  removed_at timestamptz,
  removed_by uuid,
  removed_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, client_id, pack_key)
);

CREATE INDEX IF NOT EXISTS evidence_client_packs_org_pack_idx
  ON public.evidence_client_packs (organization_id, pack_key);

CREATE INDEX IF NOT EXISTS evidence_client_packs_client_idx
  ON public.evidence_client_packs (client_id);

ALTER TABLE public.evidence_client_packs ENABLE ROW LEVEL SECURITY;

-- Same rules as evidence_items: members read, owners / agency admins write.
CREATE POLICY "evidence_client_packs_select_org_member" ON public.evidence_client_packs
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()) OR is_hive_executive(auth.uid()));

CREATE POLICY "evidence_client_packs_insert_admin" ON public.evidence_client_packs
  FOR INSERT TO authenticated
  WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()) OR is_hive_executive(auth.uid()));

CREATE POLICY "evidence_client_packs_update_admin" ON public.evidence_client_packs
  FOR UPDATE TO authenticated
  USING (is_org_admin_or_manager(organization_id, auth.uid()) OR is_hive_executive(auth.uid()))
  WITH CHECK (is_org_admin_or_manager(organization_id, auth.uid()) OR is_hive_executive(auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.evidence_client_packs TO authenticated;
