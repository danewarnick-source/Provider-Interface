-- Scheduler S1: helper functions for scheduler writes.
-- access_can_write_shift: owner / agency admin, or a `scheduling` editor
--   (scoped managers only for clients they can see).
-- access_can_write_day_program: owner / agency admin, or a `scheduling` editor.

CREATE OR REPLACE FUNCTION public.access_can_write_shift(_org uuid, _user uuid, _client uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_org_admin_or_manager(_org, _user)
    OR (
      public.access_has_category(_org, _user, 'scheduling', 'edit')
      AND EXISTS (
        SELECT 1 FROM public.organization_members m
        WHERE m.organization_id = _org AND m.user_id = _user AND m.active
          AND (
            m.access_scope = 'agency'
            OR (_client IS NOT NULL AND public.access_can_see_client(_client, _user))
          )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.access_can_write_day_program(_org uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_org_admin_or_manager(_org, _user)
    OR public.access_has_category(_org, _user, 'scheduling', 'edit');
$$;

GRANT EXECUTE ON FUNCTION public.access_can_write_shift(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.access_can_write_day_program(uuid, uuid) TO authenticated;
