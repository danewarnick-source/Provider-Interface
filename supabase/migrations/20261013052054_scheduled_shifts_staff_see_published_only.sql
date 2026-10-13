-- Scheduler S1: staff only see published shifts (and only their own, open ones, or
-- those on clients/homes they are assigned to). Owners, agency admins and
-- `scheduling` viewers see everything including drafts.

CREATE OR REPLACE FUNCTION public.access_can_read_shift(
  _org uuid, _user uuid, _staff uuid, _client uuid, _published boolean, _status text
) RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_org_admin_or_manager(_org, _user)
    OR public.access_has_category(_org, _user, 'scheduling', 'view')
    OR (
      _published
      AND public.is_org_member(_org, _user)
      AND (
        _staff = _user
        OR (_staff IS NULL AND _status = 'open')
        OR (_client IS NOT NULL AND (
          EXISTS (SELECT 1 FROM public.staff_assignments sa
                  WHERE sa.organization_id = _org AND sa.staff_id = _user AND sa.client_id = _client)
          OR EXISTS (SELECT 1 FROM public.clients c
                     JOIN public.access_assignments aa
                       ON aa.organization_id = c.organization_id AND aa.user_id = _user
                      AND aa.kind = 'home' AND aa.target_id = c.team_id
                     WHERE c.id = _client AND c.organization_id = _org)
        ))
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.access_can_read_shift(uuid, uuid, uuid, uuid, boolean, text) TO authenticated;

ALTER POLICY "Org members can view shifts" ON public.scheduled_shifts
  USING (public.access_can_read_shift(organization_id, auth.uid(), staff_id, client_id, published, status));
