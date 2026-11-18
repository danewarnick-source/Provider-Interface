-- B4: the record of edits to PUBLISHED shifts — before/after, when sent, who saw it.
-- Why a table: nothing existing holds "what changed, was it sent, did they see it"
-- (B4 plan, Dane approved Nov 18). Drafts that were never published make no rows.
CREATE TABLE public.shift_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  shift_id uuid NOT NULL REFERENCES public.scheduled_shifts(id) ON DELETE RESTRICT,
  affected_staff_ids uuid[] NOT NULL DEFAULT '{}',
  before jsonb NOT NULL,
  after jsonb NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX shift_changes_org_unsent_idx ON public.shift_changes (organization_id) WHERE sent_at IS NULL;
CREATE INDEX shift_changes_shift_idx ON public.shift_changes (shift_id);
CREATE INDEX shift_changes_affected_idx ON public.shift_changes USING gin (affected_staff_ids);

-- Why a second table: each affected person taps "Got it" separately.
CREATE TABLE public.shift_change_acks (
  change_id uuid NOT NULL REFERENCES public.shift_changes(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  acked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (change_id, staff_id)
);

ALTER TABLE public.shift_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_change_acks ENABLE ROW LEVEL SECURITY;

-- Schedulers read and write their agency's changes; affected staff read their own. No deletes.
CREATE POLICY "shift changes read" ON public.shift_changes FOR SELECT TO authenticated
  USING (public.access_has_category(organization_id, auth.uid(), 'scheduling', 'view')
         OR (auth.uid() = ANY (affected_staff_ids) AND public.is_org_member(organization_id, auth.uid()))
         OR public.is_hive_executive(auth.uid()));
CREATE POLICY "shift changes insert" ON public.shift_changes FOR INSERT TO authenticated
  WITH CHECK (public.access_has_category(organization_id, auth.uid(), 'scheduling', 'edit'));
CREATE POLICY "shift changes update" ON public.shift_changes FOR UPDATE TO authenticated
  USING (public.access_has_category(organization_id, auth.uid(), 'scheduling', 'edit'))
  WITH CHECK (public.access_has_category(organization_id, auth.uid(), 'scheduling', 'edit'));

-- Acks: a person acknowledges only a sent change that affects them; schedulers read them.
CREATE POLICY "shift change acks read" ON public.shift_change_acks FOR SELECT TO authenticated
  USING (staff_id = auth.uid()
         OR public.access_has_category(organization_id, auth.uid(), 'scheduling', 'view')
         OR public.is_hive_executive(auth.uid()));
CREATE POLICY "shift change acks insert own" ON public.shift_change_acks FOR INSERT TO authenticated
  WITH CHECK (staff_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.shift_changes c
    WHERE c.id = shift_change_acks.change_id
      AND c.organization_id = shift_change_acks.organization_id
      AND c.sent_at IS NOT NULL
      AND auth.uid() = ANY (c.affected_staff_ids)));
