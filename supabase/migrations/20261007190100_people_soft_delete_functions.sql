-- Delete (hide) and restore a client or team member made by mistake.
-- New SECURITY DEFINER functions only; no existing policy or function changes.
-- Every function resolves the agency from the person's own row and checks the
-- caller there: Owner, or the "Delete people" permission (delete_people = edit
-- in the caller's preset or overrides), plus normal visibility of that person.
-- No row is ever removed. _kind is 'client' (clients.id) or 'member'
-- (organization_members.id).

CREATE OR REPLACE FUNCTION public.people_delete_allowed(_org uuid, _user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT _user IS NOT NULL AND (
    public.access_is_owner(_org, _user)
    OR COALESCE(public.access_categories(_org, _user) ->> 'delete_people', 'off') = 'edit');
$$;

-- Agency of the person, after the caller's permission and visibility checks.
CREATE OR REPLACE FUNCTION public.people_delete_assert(_kind text, _id uuid)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
declare
  v_org uuid;
  v_user uuid;
begin
  if _kind = 'client' then
    select organization_id into v_org from public.clients where id = _id;
  elsif _kind = 'member' then
    select organization_id, user_id into v_org, v_user from public.organization_members where id = _id;
  else
    raise exception 'Unknown kind of person' using errcode = '22023';
  end if;
  if v_org is null then
    raise exception 'Person not found in this organization' using errcode = 'P0002';
  end if;
  if not public.people_delete_allowed(v_org, auth.uid())
     or (_kind = 'client' and not public.access_can_see_client(_id, auth.uid()))
     or (_kind = 'member' and not public.access_can_see_staff(v_org, v_user, auth.uid())) then
    raise exception 'You don''t have permission to delete people' using errcode = '42501';
  end if;
  return v_org;
end;
$$;

-- Service records that make a person "real": counts per kind of record.
CREATE OR REPLACE FUNCTION public.person_service_history(_kind text, _id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
declare
  v_org uuid := public.people_delete_assert(_kind, _id);
  v_user uuid;
begin
  if _kind = 'client' then
    return jsonb_build_object(
      'shifts', (select count(*) from public.scheduled_shifts
                  where organization_id = v_org and client_id = _id and status <> 'cancelled'),
      'punches', (select count(*) from public.evv_timesheets where organization_id = v_org and client_id = _id),
      'notes', (select count(*) from public.shift_reports where organization_id = v_org and client_id = _id)
             + (select count(*) from public.submitted_forms where organization_id = v_org and client_id = _id),
      'daily_logs', (select count(*) from public.daily_logs where organization_id = v_org and client_id = _id),
      'med_passes', (select count(*) from public.emar_logs where organization_id = v_org and client_id = _id),
      'billing', (select count(*) from public.hhs_monthly_attendance where organization_id = v_org and client_id = _id)
               + (select count(*) from public.hhs_monthly_certifications where organization_id = v_org and client_id = _id),
      'signed_documents', (select count(*) from public.form_submissions where organization_id = v_org and client_id = _id)
                        + (select count(*) from public.upi_attestations where organization_id = v_org and client_id = _id),
      'summaries', (select count(*) from public.client_progress_summaries
                     where organization_id = v_org and client_id = _id and status not in ('pending', 'no_source'))
                 + (select count(*) from public.hhs_monthly_summaries where organization_id = v_org and client_id = _id));
  end if;
  select user_id into v_user from public.organization_members where id = _id;
  return jsonb_build_object(
    'shifts', (select count(*) from public.scheduled_shifts
                where organization_id = v_org and staff_id = v_user and status <> 'cancelled'),
    'punches', (select count(*) from public.evv_timesheets where organization_id = v_org and staff_id = v_user)
             + (select count(*) from public.general_shifts where organization_id = v_org and user_id = v_user),
    'notes', (select count(*) from public.shift_reports where organization_id = v_org and staff_id = v_user)
           + (select count(*) from public.submitted_forms where organization_id = v_org and user_id = v_user),
    'daily_logs', (select count(*) from public.daily_logs where organization_id = v_org and user_id = v_user),
    'med_passes', (select count(*) from public.emar_logs where organization_id = v_org and staff_id = v_user),
    'billing', (select count(*) from public.billing_submissions where organization_id = v_org and submitted_by = v_user)
             + (select count(*) from public.hhs_monthly_attendance where organization_id = v_org and signee_user_id = v_user),
    'signed_documents', (select count(*) from public.policy_signatures where organization_id = v_org and user_id = v_user)
                      + (select count(*) from public.form_submissions where organization_id = v_org and submitted_by = v_user),
    'summaries', (select count(*) from public.client_progress_summaries
                   where organization_id = v_org and (finalized_by = v_user or completed_by = v_user)));
end;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_person(_kind text, _id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare
  v_org uuid := public.people_delete_assert(_kind, _id);
  v_history jsonb := public.person_service_history(_kind, _id);
  v_reason text := nullif(btrim(coalesce(_reason, '')), '');
  v_member record;
begin
  if v_reason is null then raise exception 'Say why this person is being deleted.'; end if;
  if exists (select 1 from jsonb_each_text(v_history) where value::bigint > 0) then
    raise exception 'This person has service records, so they can''t be deleted.' using errcode = '23503';
  end if;
  if _kind = 'client' then
    update public.clients
      set deleted_at = now(), deleted_by = auth.uid(), delete_reason = v_reason
      where id = _id and deleted_at is null;
  else
    select user_id, access_level into v_member from public.organization_members where id = _id;
    if v_member.user_id = auth.uid() then raise exception 'You can''t delete yourself.'; end if;
    if v_member.access_level = 'owner' then raise exception 'Owners can''t be deleted.'; end if;
    -- Deactivated too, so the person can't sign in to this agency while deleted.
    update public.organization_members
      set deleted_at = now(), deleted_by = auth.uid(), delete_reason = v_reason, active = false
      where id = _id and deleted_at is null;
  end if;
  if not found then raise exception 'This person is already deleted.'; end if;
end;
$$;

-- Restore is Owner-only (Settings → Recently deleted). A restored team member
-- comes back deactivated; Reactivate on their profile lets them sign in again.
CREATE OR REPLACE FUNCTION public.restore_deleted_person(_kind text, _id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare
  v_org uuid := public.people_delete_assert(_kind, _id);
begin
  if not public.access_is_owner(v_org, auth.uid()) then
    raise exception 'Only Owners can restore deleted people' using errcode = '42501';
  end if;
  if _kind = 'client' then
    update public.clients set deleted_at = null, deleted_by = null, delete_reason = null
      where id = _id and deleted_at is not null;
  else
    update public.organization_members set deleted_at = null, deleted_by = null, delete_reason = null
      where id = _id and deleted_at is not null;
  end if;
  if not found then raise exception 'This person isn''t deleted.'; end if;
end;
$$;

REVOKE ALL ON FUNCTION public.people_delete_allowed(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.people_delete_assert(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.person_service_history(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.soft_delete_person(text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_deleted_person(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.people_delete_allowed(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.people_delete_assert(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.person_service_history(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_person(text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_deleted_person(text, uuid) TO authenticated;
